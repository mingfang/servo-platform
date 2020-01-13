var NLUModel = require('../core/NLUModel');
var _ = require('underscore');
var dblogger = require('../../utils/dblogger');

// class MyRegExp extends RegExp {
//     [Symbol.matchAll](str) {
//         let result = RegExp.prototype[Symbol.matchAll].call(this, str);
//         if (!result) {
//             return null;
//         }
//         return Array.from(result);
//     }
// }

// expected output: Array [Array ["-01"], Array ["-02"], Array ["-03"], Array ["-07"]]

/**
 * dictionary model - entity classifier
 * @memberof module:NLUModels
 * @private
 */
class DictModel extends NLUModel {

    constructor() {
        super();
        this.title = "Dictionary";
        this.description = 'Use a dictionary from properties to find entities in message text';
        this.title = this.name = 'DictModel';

        /**
         * Node parameters.
         *
         * @property parameters
         * @type {Object}
         * @property {Object} parameters.nlu -this gets added onto the process properties to get used for NLU.
         * Use language code as a key: {
         *
         * 'en': {
         *    engine: 'wit',
         *
         *     accessToken: '<your token>'
         *
         * }}
         **/
        this.parameters = _.extend(this.parameters, {
            dictionary: {
                'en': {
                    filename: ''
                }
            }
        });


    }

    /**
     * defines validation methods to execute at the editor; if one of them fails, a dashed red border is displayed for the node
     * @return {Array<Validator>}
     */
    validators(node) {
        function engineFinder(nluObj) {
            for (var lang in nluObj) {
                if (nluObj[lang].filename === '') {
                    return false;
                }
            }

            return true;
        }


        return [{
            condition: node.child,
            text: "should have a child"
        }, {
            condition: node.properties.dictionary,
            text: "properties should have a dictionary"
        }, {
            condition: engineFinder(node.properties.dictionary),
            text: "a filename should exist for all languages"
        }];
    }

    addEntity(tick, id, value) {
        // dont use addEntity - override previous NLU engines, but not ourselves
        if (!tick.target.getMessageObj().entities[id + "#confidence"] ||
            (tick.target.getMessageObj().entities[id + "#confidence"][0] &&
                tick.target.getMessageObj().entities[id + "#confidence"][0] < 1000.0)) {
            // add
            tick.target.getMessageObj().entities[id] = [value];
            //tick.target.getMessageObj().addEntity(dict.data.id + "#confidence", 100.0);
            // huge confidence factor to prevent context switching if this entity was identified as another one
            tick.target.getMessageObj().entities[id + "#confidence"] = [1000.0];
            dblogger.info('DictModel add entity with id ' + id + ' and value ' + value);
        }
    }
    /**
     * Tick method.
     *
     * @private
     * @param {Tick} tick A tick instance.
     * @return {TickStatus} A status constant.
     **/
    tick(tick) {
        try {
            let dict = require(this.properties.dictionary[tick.process.properties()['defaultLang']].filename);
            if (tick.target.getMessageObj()) {
                let text = tick.target.getMessageObj().text;
                // let entities = {};
                for (let valuekey in dict.data.values) {
                    let value = dict.data.values[valuekey];

                    for (let expkey in value.expressions) {
                        let expRe = new RegExp("\\b" + value.expressions[expkey] + "\\b", "gmi");

                        if (expRe.exec(text)) {
                            // entities[dict.data.id] = [value.value];
                            // entities[dict.data.id + "#confidence"] = 1.0;

                            // dont use addEntity - override previous NLU engines
                            tick.target.getMessageObj().entities[dict.data.id] = [value.value];
                            //tick.target.getMessageObj().addEntity(dict.data.id + "#confidence", 100.0);
                            // huge confidence factor to prevent context switching if this entity was identified as another one
                            tick.target.getMessageObj().entities[dict.data.id + "#confidence"] = [1000.0];
                            dblogger.info('DictModel add entity with id ' + dict.data.id + ' and value ' + value.value);

                        }
                    }
                    // regexps
                    for (let expkey in value.regExpressions) {
                        let expRe = new RegExp(value.regExpressions[expkey], "gmi");
                        //let founds = text && text.matchAll(value.regExpressions[expkey], "gmi");
                        let founds = expRe.exec(text)
                        for (let i = 0; founds && i < founds.length; i++) {
                            this.addEntity(tick, dict.data.id, founds[i]);
                            if (founds[i]) {
                                break;
                            }
                        }
                    }
                }
            }

            // continue on
            return this.child._execute(tick);

        } catch (ex) {
            this.error(tick, "DictModel of " + this.properties.dictionary, ex);
        }

    }
}

module.exports = DictModel;