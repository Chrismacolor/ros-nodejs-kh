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

var msgUtils = require('../utils/message_utils.js');
var timeUtils = require('../lib/Time.js');
var log = require('../lib/Logging.js').getLogger('ros.rosnodejs');

var GoalStatus = null;
var GoalStatuses = null;

var GoalHandle = function () {
  /**
   * goalId: An actionlib_msgs/GoalID.
   * actionServer: The ActionServer processing this goal
   * status: A number from actionlib_msgs/GoalStatus, like GoalStatuses.PENDING.
   * goal: The goal message, e.g., a FibonacciGoal. May be left undefined if
   *  this goal is used to represent a cancellation.
   */
  function GoalHandle(goalId, actionServer, status, goal) {
    _classCallCheck(this, GoalHandle);

    if (goalId.id === '') {
      goalId = actionServer.generateGoalId();
    }

    if (timeUtils.isZeroTime(goalId.stamp)) {
      goalId.stamp = timeUtils.now();
    }

    this.id = goalId.id;

    this._as = actionServer;

    if (GoalStatus === null) {
      GoalStatus = msgUtils.requireMsgPackage('actionlib_msgs').msg.GoalStatus;
      GoalStatuses = GoalStatus.Constants;
    }

    this._status = new GoalStatus({
      status: status || GoalStatuses.PENDING,
      goal_id: goalId
    });

    this._goal = goal;

    this._destructionTime = timeUtils.epoch();
  }

  _createClass(GoalHandle, [{
    key: '_isTerminalState',
    value: function _isTerminalState() {
      return [GoalStatuses.REJECTED, GoalStatuses.RECALLED, GoalStatuses.PREEMPTED, GoalStatuses.ABORTED, GoalStatuses.SUCCEEDED].includes(this._status.status);
    }
  }, {
    key: 'getStatusId',
    value: function getStatusId() {
      return this._status.status;
    }
  }, {
    key: 'getGoalId',
    value: function getGoalId() {
      return this._status.goal_id;
    }
  }, {
    key: 'getGoalStatus',
    value: function getGoalStatus() {
      return this._status;
    }
  }, {
    key: 'getGoal',
    value: function getGoal() {
      return this._goal;
    }
  }, {
    key: 'publishFeedback',
    value: function publishFeedback(feedback) {
      this._as.publishFeedback(this._status, feedback);
    }
  }, {
    key: '_setStatus',
    value: function _setStatus(status, text) {
      this._status.status = status;
      if (text) {
        this._status.text = text;
      }

      // FIXME: just guessing about setting destruction time
      if (this._isTerminalState()) {
        this._destructionTime = timeUtils.now();
      }

      this._as.publishStatus();
    }
  }, {
    key: '_publishResult',
    value: function _publishResult(result) {
      this._as.publishResult(this._status, result);
    }

    // For Goal State transitions, See
    // http://wiki.ros.org/actionlib/DetailedDescription#Server_Description

  }, {
    key: 'setCancelled',
    value: function setCancelled(result) {
      var text = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

      var status = this.getStatusId();
      switch (status) {
        case GoalStatuses.RECALLING:
          this._setStatus(GoalStatuses.RECALLED, text);
          this._publishResult(result);
          break;
        case GoalStatuses.PREEMPTING:
          this._setStatus(GoalStatuses.PREEMPTED, text);
          this._publishResult(result);
          break;
        default:
          this._logInvalidTransition('setCancelled', status);
          break;
      }
    }
  }, {
    key: 'setRejected',
    value: function setRejected(result) {
      var text = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

      var status = this.getStatusId();
      switch (status) {
        case GoalStatuses.PENDING:
        case GoalStatuses.RECALLING:
          this._setStatus(GoalStatuses.REJECTED, text);
          this._publishResult(result);
          break;
        default:
          this._logInvalidTransition('setRejected', status);
          break;
      }
    }
  }, {
    key: 'setAccepted',
    value: function setAccepted() {
      var text = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

      var status = this.getStatusId();
      switch (status) {
        case GoalStatuses.PENDING:
          this._setStatus(GoalStatuses.ACTIVE, text);
          break;
        case GoalStatuses.RECALLING:
          this._setStatus(GoalStatuses.PREEMPTING, text);
          break;
        default:
          this._logInvalidTransition('setAccepted', status);
          break;
      }
    }
  }, {
    key: 'setAborted',
    value: function setAborted(result) {
      var text = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

      var status = this.getStatusId();
      switch (status) {
        case GoalStatuses.PREEMPTING:
        case GoalStatuses.ACTIVE:
          this._setStatus(GoalStatuses.ABORTED, text);
          this._publishResult(result);
          break;
        default:
          this._logInvalidTransition('setAborted', status);
          break;
      }
    }
  }, {
    key: 'setSucceeded',
    value: function setSucceeded(result) {
      var text = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

      var status = this.getStatusId();
      switch (status) {
        case GoalStatuses.PREEMPTING:
        case GoalStatuses.ACTIVE:
          this._setStatus(GoalStatuses.SUCCEEDED, text);
          this._publishResult(result);
          break;
        default:
          this._logInvalidTransition('setSucceeded', status);
          break;
      }
    }
  }, {
    key: 'setCancelRequested',
    value: function setCancelRequested() {
      var status = this.getStatusId();
      switch (status) {
        case GoalStatuses.PENDING:
          this._setStatus(GoalStatuses.RECALLING);
          return true;
        case GoalStatuses.ACTIVE:
          this._setStatus(GoalStatuses.PREEMPTING);
          return true;
        default:
          this._logInvalidTransition('setCancelRequested', status);
          return false;
      }
    }
  }, {
    key: '_logInvalidTransition',
    value: function _logInvalidTransition(transition, currentStatus) {
      log.warn('Unable to %s from status %s for goal %s', transition, currentStatus, this.id);
    }
  }]);

  return GoalHandle;
}();

module.exports = GoalHandle;