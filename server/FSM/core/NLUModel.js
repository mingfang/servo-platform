var b3 = require('./b3')
var Decorator = require('./decorator')
var fsmModel = require('../../models/fsmmodel')
var dblogger = require('../../utils/dblogger');
var utils = require('../../utils/utils');
var _ = require('underscore');

/**
 * NLUModel is the base class for all machine learning models nodes.
 * it is a decorartor whose purpose is to change the current model used at
 * the root of tree to a certain model. the model depends on the input type -
 * for chat bot it would be an NLU model, for voice, ASR + NLU, for image, some image recognitions .
 * @memberof module:Core
 * @private
 **/
class NLUModel extends Decorator {

  /**
   * constructor
   */
  constructor() {
    super();
    this.category = b3.NLUMODEL;
  }

  /**
   * overridable, reset waitRetCode
   * @param {Tick} tick
   */
  open(tick) {
    this.waitCode(tick, undefined);
  }

  /**
   * default tick
   */
  /**
   * Tick method.
   *
   * @private
   * @param {Tick} tick A tick instance.
   * @return {TickStatus} A state constant.
   **/
  tick(tick) {
    if (!this.child) {
      return b3.ERROR();
    }

    var props = _.extend(tick.process.properties(), this.properties);
    tick.process.properties(props);

    var status = this.child._execute(tick);

    return status;

  }
}
module.exports = NLUModel;