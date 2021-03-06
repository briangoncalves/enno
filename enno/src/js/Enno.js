function Enno() {
    this.source = null;
    this.sourceListing = null;
    this.sourceConfig = null;
    this.sourceConfigReverse = null;
    this.sampleID = null;
    this.sample = null;

    this.container = document.getElementById('sample-container');
    this.connectionMapping = {};

    var that = this;

    // initialise global event listeners
    this.container.addEventListener('mouseup', function (e) {
        if (window.getSelection().toString())
            that.eventHandlerSelection(e);
        else if (e.target !== e.currentTarget && Enno.isEventOnDenotation(e))
            that.eventHandlerClickDenotation(e);

        e.stopPropagation();
    }, false);

    window.addEventListener('keyup', function (e) {
        if (e.key === 'Escape') {
            that.eventHandlerDenotationSelectionReset();
            that.eventHandlerRelationSelectionReset();
        }
        if (e.key === 'Delete') that.eventHandlerRemoveKey();
    });

    // navigation buttons
    this.initNavigationButtons();
}

Enno.getSelectionRangeWithin = function (element) {
    // taken from: http://jsfiddle.net/UuDpL/2/
    // posted here: https://stackoverflow.com/questions/7991474/calculate-position-of-selected-text-javascript-jquery
    var start = 0, end = 0;
    var sel, range, priorRange;
    if (typeof window.getSelection !== "undefined") {
        range = window.getSelection().getRangeAt(0);
        priorRange = range.cloneRange();
        priorRange.selectNodeContents(element);
        priorRange.setEnd(range.startContainer, range.startOffset);
        start = priorRange.toString().length;
        end = start + range.toString().length;
    } else if (typeof document.selection !== "undefined" &&
        (sel = document.selection).type !== "Control") {
        range = sel.createRange();
        priorRange = document.body.createTextRange();
        priorRange.moveToElementText(element);
        priorRange.setEndPoint("EndToStart", range);
        start = priorRange.text.length;
        end = start + range.text.length;
    }
    return {
        start: start,
        end: end
    };
};

Enno.removeSelectionRange = function () {
    // taken from https://stackoverflow.com/a/1643608/5904163
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    } else if (document.selection) {
        document.selection.empty();
    }
};

Enno.prototype.initNavigationButtons = function () {
    var that = this;
    document.getElementById('select-sample-button-list').addEventListener('click', function (e) {
        SelectionModal(that.sourceListing.nested, e, function (o) {
            var icon = o['has_annotation'] ? 'fa-file-code-o' : 'fa-file-o';
            return '<i class="fa ' + icon + '" aria-hidden="true"></i>&nbsp;' + o['name'];
        }, function (o) {
            return o['sample'];
        }).then(function (nextSample) {
            that.selectSample(nextSample);
        }).catch(function (error) {
            console.log(error);
        });
    });
    document.getElementById('select-sample-button-prev').addEventListener('click', function (e) {
        prevNext(-1);
    });
    document.getElementById('select-sample-button-next').addEventListener('click', function (e) {
        prevNext(1);
    });

    function prevNext(direction) {
        var current = that.sourceListing.flat.findIndex(function (sample) {
            return sample['sample'] === that.sampleID;
        });
        var nextIndex = current + direction;
        if (nextIndex < 0) nextIndex = that.sourceListing.flat.length - 1;
        if (nextIndex > that.sourceListing.flat.length - 1) nextIndex = 0;
        return that.selectSample(that.sourceListing.flat[nextIndex].sample);
    }
};

Enno.prototype.showSources = function () {
    // TODO
    // displays modal with all configured data sources
};

Enno.prototype.selectSource = function (source) {
    var that = this;
    return new Promise(function (resolve, reject) {
        Promise.all([API.getConfig(source), API.getSamples(source)]).then(function (results) {
            var conf = results[0];
            var samples = results[1];

            that.source = source;
            that.sourceConfig = conf;
            that.sourceConfigReverse = buildReverseConfig(conf);

            that.sourceListing = {
                'nested': {'folders': samples['folders'], 'docs': samples['docs']},
                'flat': samples['flat']
            };
            resolve(results);
        }).catch(function (error) {
            console.error('meh. set source error');
            console.log(error);
            reject(error);
        })
    });

    function buildReverseConfig(conf) {
        conf = conf.options;
        var ret = {from: {}, to: {}};
        for (var rel in conf.relationTypes) {
            buildList(conf.relationTypes[rel].from, conf.relationTypes[rel].to, rel);
            if (conf.relationTypes[rel].type.indexOf('symmetric') >= 0)
                buildList(conf.relationTypes[rel].to, conf.relationTypes[rel].from, rel);
        }
        return ret;

        function buildList(origins, targets, relation) {
            origins.forEach(function (denoFrom) {
                if (!(denoFrom in ret.from)) ret.from[denoFrom] = {};
                targets.forEach(function (denoTo) {
                    if (!(denoTo in ret.to)) ret.to[denoTo] = {};
                    if (!(denoFrom in ret.to[denoTo])) ret.to[denoTo][denoFrom] = [];
                    if (!(denoTo in ret.from[denoFrom])) ret.from[denoFrom][denoTo] = [];
                    if (ret.from[denoFrom][denoTo].indexOf(relation) < 0) ret.from[denoFrom][denoTo].push(relation);
                    if (ret.to[denoTo][denoFrom].indexOf(relation) < 0) ret.to[denoTo][denoFrom].push(relation);
                });
            });
        }
    }
};

Enno.prototype.selectSample = function (sample) {
    var that = this;

    return new Promise(function (resolve, reject) {
        if (!sample) {
            API.getLastSample(that.source).then(success).catch(fail);
        } else {
            if (typeof sample === 'number')
                sample = that.sourceListing.flat[sample]['sample'];
            API.getSample(that.source, sample).then(success).catch(fail);
        }

        function success(result) {
            that.sampleID = result['id'];
            document.getElementById('sample-indicator').innerHTML = result['id'];
            that.sample = result;
            that.renderText();
            resolve(result);
        }

        function fail(error) {
            console.error('meh. sample select failed.');
            console.log(error);
            reject(error);
        }
    });
};

Enno.connecionConfig = {
    connector: ['Bezier', {curviness: 100}],
    anchor: ['Top', 'Top'],
    endpoint: ["Dot", {radius: 5}]
};

Enno.prototype.renderText = function () {
    var that = this;

    jsPlumb.reset();

    this.container.innerHTML = this.getTextAsHtml();

    // add jsplumb endpoints
    (this.sample.denotations || []).forEach(function (denotation) {
        var isSource = denotation.type in that.sourceConfigReverse.from;
        var isTarget = denotation.type in that.sourceConfigReverse.to;
        // hint: does not allow untyped denotations to be linked!
        if (isSource || isTarget) {
            var endpoint = jsPlumb.addEndpoint('deno-' + denotation.id, {
                isSource: isSource,
                isTarget: isTarget
            }, Enno.connecionConfig);

            //endpoint.bind('click', that.eventHandlerEndpointClick())
        }
    });

    // draw existing relations
    (this.sample.relations || []).forEach(function (relation) {
        that.drawRelation(relation);
    });
};

Enno.prototype.drawRelation = function (relation) {
    var that = this;
    var relationId = 'rela-' + relation.id;
    var connection = {
        source: 'deno-' + relation.origin,
        target: 'deno-' + relation.target,
        overlays: [
            ["Arrow", {location: -3, length: 15, width: 8}],
            ["Label", {
                label: relation.type, location: 0.5, cssClass: 'relation-label',
                id: relationId,
                events: {
                    click: that.eventHandlerClickRelation()
                }
            }]
        ]
    };
    if (this.sourceConfig.options.relationTypes[relation.type].type.indexOf('symmetric') >= 0)
        connection.overlays.push(["Arrow", {location: 3, length: 15, width: 8, direction: -1}]);
    var newConnection = jsPlumb.connect(connection, Enno.connecionConfig);
    this.connectionMapping[newConnection.getOverlays()[relationId].getElement().id] = {
        relationId: relationId,
        connectionId: newConnection.id
    };
};

Enno.prototype.eventHandlerClickDenotation = function (e) {
    var clickedDenotationElement = Enno.getDenotationElementFromEvent(e);
    console.log('clicked denotation ' + Enno.idFromElement(clickedDenotationElement) +
        ' with type ' + Enno.typeFromElement(clickedDenotationElement));

    var selectedDenotations = Enno.getSelectedDenotations();
    this.eventHandlerDenotationSelectionSet(e);

    var that = this;
    if (selectedDenotations.length > 0) {
        var origin = selectedDenotations[0];
        var target = clickedDenotationElement;
        var originType = Enno.typeFromElement(origin);
        var targetType = Enno.typeFromElement(target);
        var originId = Enno.idFromElement(origin);
        var targetId = Enno.idFromElement(target);
        if (originId === targetId) {
            console.log('same denotation clicked!');
            this.eventHandlerDenotationSelectionReset(target);
        } else {
            var possibleTypes = ((that.sourceConfigReverse.from[originType] || {})[targetType] || []);
            if (possibleTypes.length > 0) {
                SelectionModal(possibleTypes, e).then(function (type) {
                    that.addRelation({
                        'id': null,
                        'origin': originId,
                        'target': targetId,
                        'type': type,
                        'meta': null
                    });
                    that.eventHandlerDenotationSelectionReset();
                }).catch(function (data) {
                    console.error('meh. relation add failed');
                    console.log(data);
                    that.eventHandlerDenotationSelectionReset();
                });
            } else {
                console.warn('No relation defined between ' + originType + ' and ' + targetType);
            }
        }
    }
};

Enno.prototype.eventHandlerClickRelation = function () {
    var that = this;
    return function (overlay, event) {
        var relationId = Enno.idFromElement(overlay.id);
        var relationType = overlay.getLabel();

        console.log('clicked relation ' + relationId + ' with type ' + relationType);
        var selectedRelations = that.getSelectedRelations();
        if (selectedRelations.length === 0) {
            overlay.getElement().classList.add('selected');
        } else {
            that.eventHandlerRelationSelectionReset(overlay.id);
        }
    };
};

Enno.idFromElement = function (elem) {
    var str = (elem instanceof HTMLElement) ? elem.getAttribute('id') : elem;
    return Number(str.replace(/^\D+/g, ''));
};
Enno.typeFromElement = function (elem) {
    return elem.getAttribute('type');
};

Enno.getSelectedDenotations = function () {
    return document.querySelectorAll('denotation.selected');
};
Enno.prototype.getSelectedRelations = function () {
    var that = this;
    var ret = [];
    document.querySelectorAll('div.relation-label.selected').forEach(function (elem) {
        ret.push({
            element: elem,
            id: Enno.idFromElement(that.connectionMapping[elem.id].relationId),
            relationId: that.connectionMapping[elem.id].relationId,
            connectionId: that.connectionMapping[elem.id].connectionId
        });
    });
    return ret;
};

Enno.prototype.eventHandlerRelationSelectionReset = function (target) {
    if (!target || typeof target === 'string') {
        this.getSelectedRelations().forEach(function (selectedRelation) {
            if (!target || selectedRelation.relationId === target) {
                remove(selectedRelation.element);
            }
        });
    } else if (target instanceof Event) {
        remove(target.target);
    } else if (target instanceof HTMLElement) {
        remove(target);
    }

    function remove(elem) {
        elem.classList.remove('selected');
    }
};

Enno.prototype.eventHandlerDenotationSelectionReset = function (target) {
    if (!target) {
        Enno.getSelectedDenotations().forEach(function (denotation) {
            remove(denotation);
        })
    } else if (target instanceof Event) {
        remove(Enno.getDenotationElementFromEvent(target));
    } else if (target instanceof HTMLElement) {
        remove(target);
    }

    function remove(elem) {
        elem.classList.remove('selected');
    }
};
Enno.prototype.eventHandlerDenotationSelectionSet = function (target) {
    if (target instanceof Event) {
        add(Enno.getDenotationElementFromEvent(target));
    } else if (target instanceof HTMLElement) {
        add(target);
    }

    function add(elem) {
        if (!!elem)
            elem.classList.add('selected');
    }
};

Enno.getDenotationElementFromEvent = function (e) {
    if (e.target.tagName === 'DENOTATION')
        return e.target;
    if (e.target.parentNode.tagName === 'DENOTATION')
        return e.target.parentNode;
    return null;
};

Enno.isEventOnDenotation = function (e) {
    var elem = Enno.getDenotationElementFromEvent(e);
    return (!!elem);
};


Enno.prototype.eventHandlerRemoveKey = function () {
    var selectedDenotations = Enno.getSelectedDenotations();
    var selectedRelations = this.getSelectedRelations();

    var that = this;
    // by default only deletes the first if multiple are selected
    if (selectedDenotations.length > 0) {
        this.removeDenotation(Enno.idFromElement(selectedDenotations[0])).then(function (data) {
            that.renderText();
        }).catch(function (error) {
            console.error('meh. failed denotation removal!');
            console.log(error);
        });
    } else if (selectedRelations.length > 0) {
        this.removeRelation(selectedRelations[0].id).then(function (data) {
            that.renderText();
        }).catch(function (error) {
            console.error('meh. failed relation removal!');
            console.log(error);
        });
    }
};

Enno.prototype.getTextAsHtml = function () {
    var text = this.sample.text;
    var denotations = this.sample.denotations || [];
    var ret = '';
    var index = buildBoundaryIndex(denotations);

    var boundaries = Object.keys(index).map(Number);
    boundaries.sort(function (a, b) {
        return a - b;
    });

    var cursor = 0;
    boundaries.forEach(function (newCursor) {
        ret += replaceWhitespaces(text.substring(cursor, newCursor));
        cursor = newCursor;
        index[newCursor].forEach(function (reference) {
            var id = denotations[reference['di']]['id'];
            var type = denotations[reference['di']]['type'] || '';
            if (reference['type'] === 'start') {
                ret += '<denotation id="deno-' + id + '" type="' + type + '">';
            } else {
                ret += '<!-- /deno-' + id + ' (' + type + ') --></denotation>';
            }
        });
    });
    ret += replaceWhitespaces(text.substring(cursor, text.length));

    return ret;

    function replaceWhitespaces(snippet) {
        return snippet
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/ /g, '<span class="special-char">·</span>')
            .replace(/\n/g, '<span class="special-char">⤶</span><br />');
    }

    function buildBoundaryIndex(denotations) {
        var index = {};
        denotations.forEach(function (denotation, i) {
            if (!(denotation.start in index)) index[denotation.start] = [];
            if (!(denotation.end in index)) index[denotation.end] = [];

            index[denotation.start].push({'type': 'start', 'di': i, 'end': denotation.end});
            index[denotation.end].push({'type': 'end', 'di': i});
        });
        for (var boundary in index) {
            index[boundary].sort(function (a, b) {
                if (a.type === 'start' && b.type === 'start') return b.end - a.end;
                if (a.type === 'end' && b.type === 'start') return -1;
                if (a.type === 'start' && b.type === 'end') return 1;
                return 0;
            });
        }
        return index;
    }
};

Enno.prototype.getDenotationForSpan = function (start, end) {
    var ret = {
        'id': null,
        'start': start,
        'end': end,
        'text': this.sample.text.substring(start, end),
        'type': null,
        'meta': null
    };
    return ret;
    // TODO
    // returns new, if none there, existing one of overlapping?
};

Enno.prototype.addDenotation = function (newDenotation) {
    var that = this;
    return new Promise(function (resolve, reject) {
        API.upsertDenotation(that.source, that.sampleID, newDenotation.start, newDenotation.end, newDenotation.text,
            newDenotation.type, newDenotation.id, newDenotation.meta).then(function (savedDenotation) {
            if (!that.sample.denotations) that.sample.denotations = [];
            that.sample.denotations.push(savedDenotation);
            resolve(savedDenotation);
        }).catch(function (data) {
            console.error('meh.');
            console.error(data);
            reject(data);
        });
    });
};

Enno.prototype.removeDenotation = function (denotation) {
    var that = this;
    return new Promise(function (resolve, reject) {
        API.deleteDenotation(that.source, that.sampleID, denotation).then(function (removedRelations) {
            if (!that.sample.denotations) that.sample.denotations = [];
            var removeIndex = that.sample.denotations.findIndex(function (current_denotation) {
                return current_denotation['id'] === denotation;
            });
            that.sample.denotations.splice(removeIndex, 1);

            removedRelations.forEach(function (removedRelation) {
                that.removeRelationLocally(removedRelation['id']);
            });

            resolve(removedRelations);
        }).catch(function (error) {
            console.error('meh. failed to remove denotation!');
            console.error(error);
            reject(error);
        });
    });
};

Enno.prototype.addRelation = function (newRelation) {
    var that = this;
    return new Promise(function (resolve, reject) {
        API.upsertRelation(that.source, that.sampleID, newRelation.origin,
            newRelation.target, newRelation.type, newRelation.id, newRelation.meta).then(function (savedRelation) {
            if (!that.sample.relations) that.sample.relations = [];
            that.sample.relations.push(savedRelation);
            that.drawRelation(savedRelation);
            resolve(savedRelation);
        }).catch(function (data) {
            console.error('meh.');
            console.log(data);
            reject(data);
        });
    });
};

Enno.prototype.removeRelationLocally = function (relation) {
    if (!this.sample.relations) return;
    var removeIndex = this.sample.relations.findIndex(function (current_relation) {
        return current_relation['id'] === relation;
    });
    return this.sample.relations.splice(removeIndex, 1);
};

Enno.prototype.removeRelation = function (relation) {
    var that = this;
    return new Promise(function (resolve, reject) {
        API.deleteRelation(that.source, that.sampleID, relation).then(function (removedRelation) {
            that.removeRelationLocally(removedRelation['id']);
            resolve(removedRelation);
        }).catch(function (error) {
            console.error('meh. failed to remove relation!');
            console.log(error);
            reject(error);
        });
    });
};

Enno.prototype.eventHandlerSelection = function (event) {
    // nothing selected, false alarm, return!
    if (!window.getSelection().toString()) return;

    var that = this;
    var range = Enno.getSelectionRangeWithin(this.container);
    var newDenotation = this.getDenotationForSpan(range.start, range.end);

    SelectionModal(this.sourceConfig.options.denotationTypes, event).then(function (type) {
        newDenotation.type = type;
        that.addDenotation(newDenotation).then(function (savedDenotation) {
            that.renderText();
        }).catch(function (data) {
            console.error('meh. type chosen fail');
            console.log(data);
        });
    }).catch(function (error) {
        console.log('reject selection' + error);
    })
};

function SelectionModal(options, event, opt2txt, opt2id) {
    if (!!SelectionModal.killActivePromise) SelectionModal.killActivePromise();

    return new Promise(function (resolve, reject) {
        var modal = document.getElementById('selection-modal');
        var list = modal.getElementsByTagName('ul')[0];
        // reset list
        list.innerHTML = '';

        if (!opt2txt) opt2txt = function (option) {
            return option;
        };
        if (!opt2id) opt2id = function (option) {
            return option;
        };

        if (Array.isArray(options)) listFromFlat(options, list);
        else listFromNested(options, list);

        SelectionModal.killActivePromise = function () {
            done('new selection modal initiated', false);
        };
        var keylistener = window.addEventListener('keyup', function (e) {
            switch (e.key) {
                case 'Escape':
                    done('selection modal canceled', false);
                    break;
                default:
                    return;
            }
        }, true);

        modal.style.top = Math.min(event.clientY, Math.abs(window.innerHeight - 400)) + 'px';
        modal.style.left = Math.min(event.clientX, Math.abs(window.innerWidth - 320)) + 'px';
        modal.style.display = 'block';

        function done(data, successful) {
            modal.style.display = 'none';
            window.removeEventListener('keyup', keylistener);
            Enno.removeSelectionRange();
            if (successful) resolve(data);
            else reject(data);
        }

        function listFromFlat(options, list) {
            options.forEach(function (option) {
                var li = document.createElement('LI');
                li.innerHTML = opt2txt(option);
                li.setAttribute('sample-id', opt2id(option));
                li.addEventListener('click', function (e) {
                    done(this.getAttribute('sample-id'), true);
                });
                list.appendChild(li);
            });
        }

        function listFromNested(nested, list) {
            Object.keys(nested['folders']).forEach(function (folder) {
                var li = document.createElement('LI');
                li.innerHTML = '<i class="fa fa-folder-open-o" aria-hidden="true"></i>&nbsp;' + folder;
                list.appendChild(li);
                var sublist = document.createElement('UL');
                sublist.style.marginLeft = '2ch';
                sublist.style.display = 'none';
                li.addEventListener('click', function (e) {
                    sublist.style.display = (sublist.style.display === 'none') ? 'block' : 'none';
                });
                listFromNested(nested['folders'][folder], sublist);
                list.appendChild(sublist);
            });
            listFromFlat(nested['docs'] || [], list);
        }
    });
}
SelectionModal.killActivePromise = undefined;