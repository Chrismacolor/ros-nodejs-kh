/*
 *    Copyright 2017 Rethink Robotics
 *
 *    Copyright 2017 Chris Smith
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var timeUtils = require('../lib/Time.js');
var msgUtils = require('../utils/message_utils.js');
var EventEmitter = require('events');

var ActionServerInterface = require('../lib/ActionServerInterface.js');
var GoalHandle = require('./GoalHandle.js');

var GoalIdMsg = null;
var GoalStatusMsg = null;
var GoalStatusArrayMsg = null;
var GoalStatuses = null;
var goalCount = 0;

/**
 * @class ActionServer
 * EXPERIMENTAL
 *
 */

var ActionServer = function (_EventEmitter) {
  _inherits(ActionServer, _EventEmitter);

  function ActionServer(options) {
    _classCallCheck(this, ActionServer);

    var _this = _possibleConstructorReturn(this, (ActionServer.__proto__ || Object.getPrototypeOf(ActionServer)).call(this));

    if (GoalStatusMsg === null) {
      GoalStatusMsg = msgUtils.requireMsgPackage('actionlib_msgs').msg.GoalStatus;
      GoalStatuses = GoalStatusMsg.Constants;
    }

    if (GoalStatusArrayMsg === null) {
      GoalStatusArrayMsg = msgUtils.requireMsgPackage('actionlib_msgs').msg.GoalStatusArray;
    }

    _this._asInterface = new ActionServerInterface(options);

    _this._asInterface.on('goal', _this._handleGoal.bind(_this));
    _this._asInterface.on('cancel', _this._handleCancel.bind(_this));

    var actionType = _this._asInterface.getType();

    _this._messageTypes = {
      result: msgUtils.getHandlerForMsgType(actionType + 'Result'),
      feedback: msgUtils.getHandlerForMsgType(actionType + 'Feedback'),
      actionResult: msgUtils.getHandlerForMsgType(actionType + 'ActionResult'),
      actionFeedback: msgUtils.getHandlerForMsgType(actionType + 'ActionFeedback')
    };

    _this._pubSeqs = {
      result: 0,
      feedback: 0,
      status: 0
    };

    _this._goalHandleList = [];
    _this._goalHandleCache = {};

    _this._lastCancelStamp = timeUtils.epoch();

    _this._statusListTimeout = 5;
    return _this;
  }

  _createClass(ActionServer, [{
    key: 'generateGoalId',
    value: function generateGoalId() {
      return this._asInterface.generateGoalId();
    }
  }, {
    key: 'shutdown',
    value: function shutdown() {
      return this._asInterface.shutdown();
    }
  }, {
    key: '_getGoalHandle',
    value: function _getGoalHandle(id) {
      return this._goalHandleCache[id];
    }
  }, {
    key: '_handleGoal',
    value: function _handleGoal(msg) {
      var newGoalId = msg.goal_id.id;

      var handle = this._getGoalHandle(newGoalId);

      if (handle) {
        if (handle._status.status === GoalStatuses.RECALLING) {
          handle._status.status = GoalStatuses.RECALLED;
          this.publishResult(handle._status, this._createMessage('result'));
        }

        handle._destructionTime = msg.goal_id.stamp;
        return false;
      }

      handle = new GoalHandle(msg.goal_id, this, GoalStatuses.PENDING, msg.goal);
      this._goalHandleList.push(handle);
      this._goalHandleCache[handle.id] = handle;

      var goalStamp = msg.goal_id.stamp;
      // check if this goal has already been cancelled based on its timestamp
      if (!timeUtils.isZeroTime(goalStamp) && timeUtils.timeComp(goalStamp, this._lastCancelStamp) < 0) {
        handle.setCancelled(this._createMessage('result'));
        return false;
      } else {
        // track goal, I guess
        this.emit('goal', handle);
      }

      return true;
    }
  }, {
    key: '_handleCancel',
    value: function _handleCancel(msg) {
      var cancelId = msg.id;
      var cancelStamp = msg.stamp;
      var cancelStampIsZero = timeUtils.isZeroTime(cancelStamp);

      var shouldCancelEverything = cancelId === '' && cancelStampIsZero;

      var goalIdFound = false;

      for (var i = 0, len = this._goalHandleList.length; i < len; ++i) {
        var handle = this._goalHandleList[i];
        var handleId = handle.id;
        var handleStamp = handle._status.goal_id.stamp;

        if (shouldCancelEverything || cancelId === handleId || !timeUtils.isZeroTime(handleStamp) && timeUtils.timeComp(handleStamp, cancelStamp) < 0) {
          if (cancelId === handleId) {
            goalIdFound = true;
          }

          if (handle.setCancelRequested()) {
            this.emit('cancel', handle);
          }
        }
      }

      // if the requested goal_id was not found and it is not empty,
      // then we need to store the cancel request
      if (cancelId !== '' && !goalIdFound) {
        var _handle = new GoalHandle(msg, this, GoalStatuses.RECALLING);
        this._goalHandleList.push(_handle);
        this._goalHandleCache[_handle.id] = _handle;
      }

      // update the last cancel stamp if new one occurred later
      if (timeUtils.timeComp(cancelStamp, this._lastCancelStamp) > 0) {
        this._lastCancelStamp = cancelStamp;
      }
    }
  }, {
    key: 'publishResult',
    value: function publishResult(status, result) {
      var msg = this._createMessage('actionResult', { status: status, result: result });
      msg.header.stamp = timeUtils.now();
      msg.header.seq = this._getAndIncrementSeq('actionResult');
      this._asInterface.publishResult(msg);
      this.publishStatus();
    }
  }, {
    key: 'publishFeedback',
    value: function publishFeedback(status, feedback) {
      var msg = this._createMessage('actionFeedback', { status: status, feedback: feedback });
      msg.header.stamp = timeUtils.now();
      msg.header.seq = this._getAndIncrementSeq('actionFeedback');
      this._asInterface.publishFeedback(msg);
      this.publishStatus();
    }
  }, {
    key: 'publishStatus',
    value: function publishStatus() {
      var _this2 = this;

      var msg = new GoalStatusArrayMsg();
      msg.header.stamp = timeUtils.now();
      msg.header.seq = this._getAndIncrementSeq('status');

      var goalsToRemove = new Set();

      var now = timeUtils.toNumber(timeUtils.now());

      for (var i = 0, len = this._goalHandleList.length; i < len; ++i) {
        var goalHandle = this._goalHandleList[i];
        msg.status_list.push(goalHandle.getGoalStatus());

        var t = goalHandle._destructionTime;
        var tNum = timeUtils.toNumber(t);
        if (!timeUtils.isZeroTime(t) && timeUtils.toNumber(t) + this._statusListTimeout < now) {
          goalsToRemove.add(goalHandle);
        }
      }

      // clear out any old goal handles
      this._goalHandleList = this._goalHandleList.filter(function (goal) {
        // kind of funky to remove from another object in this filter...
        if (goalsToRemove.has(goal)) {
          delete _this2._goalHandleCache[goal.id];
          return false;
        }
        return true;
      });

      this._asInterface.publishStatus(msg);
    }
  }, {
    key: '_getAndIncrementSeq',
    value: function _getAndIncrementSeq(type) {
      return this._pubSeqs[type]++;
    }
  }, {
    key: '_createMessage',
    value: function _createMessage(type) {
      var args = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return new this._messageTypes[type](args);
    }
  }]);

  return ActionServer;
}(EventEmitter);

module.exports = ActionServer;