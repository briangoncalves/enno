import json
from flask import Blueprint, Response
from enno import config

adapters = {
    'enron': __import__('enno.wrappers.enron', fromlist=['enron'])
}

wrappers = Blueprint('wrappers', __name__)


def json_response(obj):
    return Response(json.dumps(obj), mimetype='application/json')


@wrappers.route('/sources')
def list_sources():
    ret = list(config['datasources'].keys())
    return json_response(ret)


@wrappers.route('/config/<source>')
def get_config(source):
    return json_response(config['datasources'][source])


@wrappers.route('/listing/<source>')
def list_files(source):
    opts = config['datasources'][source]
    return json_response(adapters[opts['wrapper']].get_listing(opts['options']))


@wrappers.route('/sample/<source>/<sample>')
def get_sample(source, sample):
    return json_response(adapters[config['datasources'][source]['wrapper']]
                         .get_sample(sample, config['datasources'][source]['options']))


@wrappers.route('/save/<source>/<sample>/<payload>')
def save_sample(source, sample, payload):
    return ''
