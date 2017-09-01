'use strict';
const Async = require('async');
const fs = require('fs-extra');
const YAML = require('yamljs');
const refParser = require('json-schema-ref-parser');
const chalk = require('chalk');
const elasticlunr = require('elasticlunr');

const Config = require('./config');
const Schema = require('./schema');
const Site = require('./site');

class Search {

  constructor(siteId) {
      this.siteId = siteId;
      const site = new Site();
      this.schemaType = site.getConfigItem(siteId, 'schema');
      this.schema = new Schema(this.schemaType).getConfig();
  }

  init() {}

  insertOne() {}

  insertMany() {}

  update() {}

  delete() {}
}

class elasticSearch extends Search {

}

class dataJsonSearch extends Search {

}

class elasticLunr extends Search {

    constructor(siteId) {
        super(siteId);
    }

    init() {
        this.idx = elasticlunr(function(){});
        this.addFields();
    }

    addFields() {
        this.idx.setRef('identifier');
        if (this.schema.facets) {
            const that = this;

            this.schema.facets.forEach(function(facet) {
                that.idx.addField(facet);
            });
        }
        this.idx.addField('title');
        this.idx.addField('body');
    }

    insertOne(item, callback) {
        // Initially setup this logic to reduce the json file size.
        var doc = {
            identifier: item.identifier,
            title: item.title,
        }
        if (this.schema.facets) {
            this.schema.facets.forEach(function(facet) {
                doc[facet] = item[facet];
            });
        }
        doc.all = stringify(item);
        // Now just adding all items. Size difference is negligable.
        this.idx.addDoc(item)
        return callback(null);
    }

    push() {
        const config = new Config();
        const buildDir = config.get('buildDir');
        const file = __dirname.replace("internals/models","") + buildDir + '/' + this.siteId + "/static/search-index.json";
        fs.outputFile(file, JSON.stringify(this.idx), err => {
            if (err) {
                console.log(err);
            }
        });
    }
}

function type(obj) {
  return Object.prototype.toString.call(obj).match(/.* (.*)\]/)[  1]
}

function stringify(obj) {
  if (type(obj) === "Function") {
    return null
  }
  if (type(obj) === "Undefined") {
    return null
  }
  if (type(obj) === "Null") {
    return "null"
  }
  if (type(obj) === "Number") {
    return obj
  }
  if (type(obj) === "String") {
    return obj
  }
  if (type(obj) === "Object" || type(obj) === "Array") {
    var result = ""
    Object.keys(obj).forEach(function(key) {
      var val = stringify(obj[key])
      if (val !== null) {
	    result = result.trim() + " " + val
      }
    })
    return result
  }
}


module.exports = {
  elasticLunr
};
