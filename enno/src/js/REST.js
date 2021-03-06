function LoadingSpinner(target) {
    // some singleton action
    if (LoadingSpinner.targetNames && LoadingSpinner.targetNames.indexOf(target) >= 0) {
        return LoadingSpinner.instances[LoadingSpinner.targetNames.indexOf(target)];
    } else {
        LoadingSpinner.targetNames = (LoadingSpinner.targetNames || []);
        LoadingSpinner.targetNames.push(target);
        LoadingSpinner.instances = (LoadingSpinner.instances || []);
        LoadingSpinner.instances.push(this);
    }
    this.instance = this;
    this.target = document.getElementById(target);
}
LoadingSpinner.prototype.start = function () {
    this.target.classList.remove('ready');
    this.target.classList.add('working');
};
LoadingSpinner.prototype.stop = function () {
    this.target.classList.remove('working');
    this.target.classList.add('ready');
};

function _API(baseurl, defaultspinner) {
    this.baseurl = baseurl || 'http://localhost:5000';
    this.defaultspinner = defaultspinner || 'api-indicator';
    this.pendingRequests = {};
}
_API.parseResponse = function(response) {
    try{
        return JSON.parse(response);
    } catch(e){
        return response;
    }
};
_API.prototype.get = function (path) {
    var loadingSpinner = new LoadingSpinner(this.defaultspinner);
    loadingSpinner.start();
    var url = this.baseurl + path;

    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (this.readyState === 4) {
                loadingSpinner.stop();
                if (this.status === 200) {
                    var result = _API.parseResponse(this.responseText);
                    resolve(result);
                } else {
                    reject('Error ' + this.status + ' ' + this.statusText);
                }
            }
        };

        xhr.open('GET', url, true);
        xhr.send();
    });
};
_API.prototype.delete = function (path) {
    var loadingSpinner = new LoadingSpinner(this.defaultspinner);
    loadingSpinner.start();
    var url = this.baseurl + path;

    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (this.readyState === 4) {
                loadingSpinner.stop();
                if (this.status === 200) {
                    var result = _API.parseResponse(this.responseText);
                    resolve(result);
                } else {
                    reject('Error ' + this.status + ' ' + this.statusText);
                }
            }
        };

        xhr.open('DELETE', url, true);
        xhr.send();
    });
};
_API.prototype.post = function (path, payload) {
    var loadingSpinner = new LoadingSpinner(this.defaultspinner);
    loadingSpinner.start();

    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (this.readyState === 4) {
                loadingSpinner.stop();
                if (this.status === 200) {
                    var result = _API.parseResponse(this.responseText);
                    resolve(result);
                } else {
                    reject('Error ' + this.status + ' ' + this.statusText);
                }
            }
        };

        // send list of elements as JSON to the server
        xhr.open('POST', path, true);
        xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
        xhr.send(JSON.stringify(payload));
    });
};

_API.routes = {
    'getSources': '/data/sources',
    'getConfig': '/data/config/{{source}}',
    'getListing': '/data/listing/{{source}}',
    'getLastSample': '/data/last-sample/{{source}}',
    'getSample': '/data/sample/{{source}}/{{sample}}',
    'upsertDenotation': '/data/denotation/{{source}}/{{sample}}',
    'deleteDenotation': '/data/denotation/{{source}}/{{denotation}}/{{sample}}',
    'upsertRelation': '/data/relation/{{source}}/{{sample}}',
    'deleteRelation': '/data/relation/{{source}}/{{relation}}/{{sample}}',
    getPath: function (route, params) {
        params = params || {};
        return _API.routes[route].replace(/{{(.*?)}}/g, function (m, param) {
            if (!(param in params) || !params[param])
                throw new ReferenceError('Parameter "' + param + '" required for ' + route + ' but not defined!');
            return encodeURIComponent(params[param])
        });
    }
};

_API.prototype.getSources = function () {
    return this.get(_API.routes.getPath('getSources'));
};

_API.prototype.getConfig = function (source) {
    return this.get(_API.routes.getPath('getConfig', {'source': source}));
};

_API.prototype.getSamples = function (source) {
    return this.get(_API.routes.getPath('getListing', {'source': source}));
};

_API.prototype.getLastSample = function (source) {
    return this.get(_API.routes.getPath('getLastSample', {'source': source}));
};

_API.prototype.getSample = function (source, sample) {
    return this.get(_API.routes.getPath('getSample', {'source': source, 'sample': sample}));
};

_API.prototype.upsertDenotation = function (source, sample, start, end, text, type, id, meta) {
    return this.post(_API.routes.getPath('upsertDenotation', {'source': source, 'sample': sample}), {
        'id': id,
        'start': start,
        'end': end,
        'text': text,
        'type': type,
        'meta': meta
    })
};

_API.prototype.deleteDenotation = function (source, sample, denotation) {
    return this.delete(_API.routes.getPath('deleteDenotation', {
        'source': source,
        'denotation': denotation,
        'sample': sample
    }));
};

_API.prototype.upsertRelation = function (source, sample, origin, target, type, id, meta) {
    return this.post(_API.routes.getPath('upsertRelation', {'source': source, 'sample': sample}), {
        'id': id,
        'origin': origin,
        'target': target,
        'type': type,
        'meta': meta
    })
};

_API.prototype.deleteRelation = function (source, sample, relation) {
    return this.delete(_API.routes.getPath('deleteRelation', {
        'source': source,
        'relation': relation,
        'sample': sample
    }));
};
