var fsmModel = require('../models/fsmmodel');
var processModel = require("../models/processmodel.js");
var _breakpointReached;
var FSMManager;
var _ = require('underscore');
var dblogger = require('../utils/dblogger');
const utils = require('../utils/utils');
/**
 * @memberof: module:Core
 * @private
 * @private  */
/**
 * helper function
 * @param {*} fsm
 * @param {*} bpData
 * @private
 */
function startOneProcess(fsm, bpData) {
  FSMManager = require('./fsm-manager');
  var chatsim = require('../chat/chatsim').getInst();
  var messageObj = chatsim.createMessageObject('reciepient-' + bpData.processId, bpData.processId, "", bpData.fsmId, {});

  return new Promise((resolve) => {
    FSMManager.startOneProcess(fsm, messageObj, bpData.processId, {
      volatileAllData: true
    }).then((process1) => {

      // the tick would start by the chatsim message
      // FSMManager = require('FSM/fsm-manager');
      // FSMManager.tickStart(fsm.userFsmId(), process1);

      process1.volatile('atABreakpoint', false);
      dblogger.flow("process " + process1.id + " created for fsm " + fsm.userFsmId());
      resolve(process1);

    });
  });

}

/**
 * return the full id based on user and id
 * @param {*} fsmId
 * @param {*} userId
 * @private  */
function getFullFsmId(fsmId, userId) {
  // calculate root folder
  const pathObj = {
    convocode: utils.CONVOCODE_DIR,
    projectsDir: userId,
    state: 'fsms',
    tree: fsmId
  };
  const fsmsRootDir = utils.getTreeDir(pathObj);
  let path = require('path');
  return path.join(fsmsRootDir, fsmId) + "#json";

}

class DebugFSM {
  /**
   * setting a single channel for all data
   * @param {Function} breakpointReached
   * @private  */
  static setBreakpointReachedCallback(breakpointReached) {
    _breakpointReached = breakpointReached;
  }

  /**
   * callback when breakpoint was reachd
   * @param {*} bpReachData
   * @private  */
  static breakpointReached(bpReachData) {
    FSMManager = require('./fsm-manager');
    //FSMManager.tickPause(bpReachData.processId);
    bpReachData.protocol = 'debugger';
    bpReachData.breakpointReached = true;
    _breakpointReached(bpReachData);
  }



  static stop(bpData) {
    return new Promise((resolve, reject) => {
      FSMManager = require('./fsm-manager');
      // stop the tick
      FSMManager.tickStop(bpData.processId);
      return processModel.deleteProcess(bpData.processId);

    });
  }

  /**
   * forward to the next node
   * @param {Object} bpData
   * @private  */
  static step(bpData) {
    return new Promise((resolve, reject) => {

      dblogger.assert(bpData.processId, "must have pid");

      var fsm = fsmModel.getFSMSync(bpData.fsmId, bpData.userId, '');
      if (!fsm) {
        return reject('WARNING: no fsm ' + bpData.fsmId);
      }

      // get the processes for this fsm
      processModel.get(bpData.processId, fsm).then((process1) => {
        process1.volatile('exitBreakpoint', true);
        process1.volatile('stepping', true);
        process1.volatile('atABreakpoint', false);
      }).catch((ex) => { // if no process yet, wait until created
        dblogger.log('no process yet: ' + bpData.processId + "/" + ex.message + "/" + ex);
        startOneProcess(fsm, bpData).then((process1) => {
          process1.volatile('stepping', true);
        });
      });


    });
  }
  /**
   * run/continue
   * @param {*} bpData
   * @private  */
  static run(bpData) {
    return new Promise((resolve, reject) => {

      dblogger.assert(bpData.processId, "must have pid");

      //let fsmId = getFullFsmId(bpData.fsmId, bpData.userId);
      var fsm = fsmModel.getFSMSync(bpData.fsmId, bpData.userId, '');
      if (!fsm) {
        return reject('WARNING: no fsm ' + bpData.fsmId);
      }
      // get the processes for this fsm
      processModel.get(bpData.processId, fsm).then((process1) => {
        process1.volatile('exitBreakpoint', true);
        process1.volatile('atABreakpoint', false);
        process1.volatile('stepping', false);
        resolve(process1);
      }).catch((ex) => {
        dblogger.log('no process yet: ' + bpData.processId + "/" + ex.message + "/" + ex);

        startOneProcess(fsm, bpData).then((p) => {
          p.volatile('stepping', false);
          resolve(p);
        });

      });

    });


  }

  /**
   * set a group of breakpoints
   * @param {string} fsmId
   * @param {string} processId
   * @param {Object} bpData
   * @private  */
  static setAllBreakpoints(fsmId, processId, bpData, userId) {
    return new Promise((resolve, reject) => {
      // let fullFsmId = getFullFsmId(fsmId, userId);
      var fsm = fsmModel.getFSMSync(fsmId, userId, '');
      if (!fsm) {
        return reject('WARNING: no fsm ' + fsmId);
      }
      // get the processes for this fsm
      var processObj = processModel.getFromCache(processId);
      _.each(bpData, (breakpoint) => {
        processObj.setBreakpoint(breakpoint);
      });
    });

  }
  /**
   *
   * @param {*} nodeId
   * @private  */
  static setBreakpoint(bpData) {
    return new Promise((resolve, reject) => {

      // get the processes for this fsm
      let fullFsmIds = fsmModel.fsmCacheKey(bpData.userId, bpData.fsmId, '');
      processModel.getActiveFSMProcesses(fullFsmIds.fsmId).then((processes) => {

        if (processes && processes.length) {
          _.each(processes, (process) => {
            process.setBreakpoint(bpData);
          });
        }


      });

    });
  }

  /**
   * clear a bp for an FSM
   * @param {*} fsmId
   * @param {*} nodeId
   * @private  */
  static clearBreakpoint(bpData) {
    return new Promise((resolve) => {
      let fullFsmIds = fsmModel.fsmCacheKey(bpData.userId, bpData.fsmId, '');
      processModel.getActiveFSMProcesses(fullFsmIds.fsmId).then((processes) => {

        for (let i = 0; i < processes.length; i++) {
          let process = processes[i];
          process.clearBreakpoint(bpData.nodeId);
        }
        resolve();

      });

    });
  }


}

module.exports = DebugFSM;