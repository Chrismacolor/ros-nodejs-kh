/*
 *    Copyright 2016 Rethink Robotics
 *
 *    Copyright 2016 Chris Smith
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

var RosNode = require('./RosNode.js');
var messageUtils = require('../utils/message_utils.js');
var namespaceUtils = require('../utils/namespace_utils.js');
var ActionClientInterface = require('./ActionClientInterface.js');
var ActionServerInterface = require('./ActionServerInterface.js');

/**
 * Handle class for nodes created with rosnodejs
 * @param node {RosNode} node that handle is attached to.
 * @param namespace {string} namespace of node. @default null
 */

var NodeHandle = function () {
  function NodeHandle(node) {
    var namespace = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    _classCallCheck(this, NodeHandle);

    this._node = node;

    this._namespace = namespace;
  }

  _createClass(NodeHandle, [{
    key: 'setNamespace',
    value: function setNamespace(namespace) {
      this._namespace = namespace;
    }
  }, {
    key: 'getNodeName',
    value: function getNodeName() {
      return this._node.getNodeName();
    }
  }, {
    key: 'isShutdown',
    value: function isShutdown() {
      return this._node && this._node.isShutdown();
    }

    //------------------------------------------------------------------
    // Pubs, Subs, Services
    //------------------------------------------------------------------
    /**
     * Creates a ros publisher with the provided options
     * @param topic {string}
     * @param type {string|Object} string representing message type or instance
     * @param [options] {object}
     * @param [options.latching] {boolean} latch messages
     * @param [options.tpcNoDelay] {boolean} set TCP no delay option on Socket
     * @param [options.queueSize] {number} number of messages to queue when publishing
     * @param [options.throttleMs] {number} milliseconds to throttle when publishing
     * @return {Publisher}
     */

  }, {
    key: 'advertise',
    value: function advertise(topic, type) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      if (!topic) {
        throw new Error('Unable to advertise unnamed topic - got ' + topic);
      }
      if (!type) {
        throw new Error('Unable to advertise topic ' + topic + ' without type - got ' + type);
      }

      try {
        options.topic = this._resolve(topic);
        if (typeof type === 'string' || type instanceof String) {
          options.type = type;
          options.typeClass = messageUtils.getHandlerForMsgType(type, true);
        } else {
          options.typeClass = type;
          options.type = type.datatype();
        }
        return this._node.advertise(options);
      } catch (err) {
        this._node._log.error('Exception trying to advertise topic ' + topic);
        throw err;
      }
    }

    /**
     * Creates a ros subscriber with the provided options
     * @param topic {string}
     * @param type {string|Object} string representing message type or instance
     * @param callback {function} function to call when message is received
     * @param [options] {object}
     * @param [options.queueSize] {number} number of messages to queue when subscribing
     * @param [options.throttleMs] {number} milliseconds to throttle when subscribing
     * @return {Subscriber}
     */

  }, {
    key: 'subscribe',
    value: function subscribe(topic, type, callback) {
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

      if (!topic) {
        throw new Error('Unable to subscribe to unnamed topic - got ' + topic);
      }
      if (!type) {
        throw new Error('Unable to subscribe to topic ' + topic + ' without type - got ' + type);
      }

      try {
        options.topic = this._resolve(topic);
        if (typeof type === 'string' || type instanceof String) {
          options.type = type;
          options.typeClass = messageUtils.getHandlerForMsgType(type, true);
        } else {
          options.typeClass = type;
          options.type = type.datatype();
        }
        return this._node.subscribe(options, callback);
      } catch (err) {
        this._node._log.error('Exception trying to subscribe to topic ' + topic);
        throw err;
      }
    }

    /**
     * Creates a ros Service server with the provided options
     * @param service {string}
     * @param type {string|Object} string representing service type or instance
     * @param callback {function} function to call when this service is called
     *   e.g.
     *     (request, response) => {
     *       response.data = !request.data;
     *       return true;
     *     }
     * @return {ServiceServer}
     */

  }, {
    key: 'advertiseService',
    value: function advertiseService(service, type, callback) {
      if (!service) {
        throw new Error('Unable to advertise unnamed service - got ' + service);
      }
      if (!type) {
        throw new Error('Unable to advertise service ' + service + ' without type - got ' + type);
      }

      try {
        var options = { service: this._resolve(service) };
        if (typeof type === 'string' || type instanceof String) {
          options.type = type;
          options.typeClass = messageUtils.getHandlerForSrvType(type, true);
        } else {
          options.typeClass = type;
          options.type = type.datatype();
        }

        return this._node.advertiseService(options, callback);
      } catch (err) {
        this._node._log.error('Exception trying to advertise service ' + service);
        throw err;
      }
    }

    /**
     * Creates a ros Service client with the provided options
     * @param service {string}
     * @param type {string|Object} string representing service type or instance
     * @param options {Object} extra options to pass to service client
     * @return {ServiceClient}
     */

  }, {
    key: 'serviceClient',
    value: function serviceClient(service, type) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      if (!service) {
        throw new Error('Unable to create unnamed service client - got ' + service);
      }
      if (!type) {
        throw new Error('Unable to create service client ' + service + ' without type - got ' + type);
      }
      options.service = this._resolve(service);

      try {
        if (typeof type === 'string' || type instanceof String) {
          options.type = type;
          options.typeClass = messageUtils.getHandlerForSrvType(type, true);
        } else {
          options.typeClass = type;
          options.type = type.datatype();
        }
        return this._node.serviceClient(options);
      } catch (err) {
        this._node._log.error('Exception trying to create service client ' + service);
        throw err;
      }
    }

    /**
     * @deprecated - use actionClientInterface
     */

  }, {
    key: 'actionClient',
    value: function actionClient() {
      return this.actionClientInterface.apply(this, arguments);
    }

    /**
     * Create an action client
     * @param  {String} actionServer name of the action server
     * (e.g., "/turtle_shape")
     * @param  {String} type action type 
     * (e.g., "turtle_actionlib/ShapeAction")
     * @return {[type]} an instance of ActionClientInterface
     */

  }, {
    key: 'actionClientInterface',
    value: function actionClientInterface(actionServer, type) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      if (!actionServer) {
        throw new Error('Unable to create action client to unspecified server - [' + actionServer + ']');
      } else if (!type) {
        throw new Error('Unable to create action client ' + actionServer + ' without type - got ' + type);
      }

      if (!type.endsWith('Action')) {
        type += 'Action';
      }

      // don't namespace action client - topics will be resolved by
      // advertising through this NodeHandle
      return new ActionClientInterface(Object.assign({}, options, {
        actionServer: actionServer,
        type: type,
        nh: this
      }));
    }
  }, {
    key: 'actionServerInterface',
    value: function actionServerInterface(actionServer, type) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      if (!actionServer) {
        throw new Error('Unable to create unspecified action server  [' + actionServer + ']');
      } else if (!type) {
        throw new Error('Unable to create action server ' + actionServer + ' without type - got ' + type);
      }

      // don't namespace action server - topics will be resolved by
      // advertising through this NodeHandle
      return new ActionServerInterface(Object.assign({}, options, {
        actionServer: actionServer,
        type: type,
        nh: this
      }));
    }

    /**
     * Stop receiving callbacks for this topic
     * Unregisters subscriber from master
     * @param topic {string} topic to unsubscribe from
     */

  }, {
    key: 'unsubscribe',
    value: function unsubscribe(topic) {
      return this._node.unsubscribe(this._resolve(topic));
    }

    /**
     * Stops publishing on this topic
     * Unregisters publisher from master
     * @param topic {string} topic to unadvertise
     */

  }, {
    key: 'unadvertise',
    value: function unadvertise(topic) {
      return this._node.unadvertise(this._resolve(topic));
    }

    /**
     * Unregister service from master
     * @param service {string} service to unadvertise
     */

  }, {
    key: 'unadvertiseService',
    value: function unadvertiseService(service) {
      return this._node.unadvertiseService(this._resolve(service));
    }

    /**
     * Polls master for service
     * @param service {string} name of service
     * @param [timeout] {number} give up after some time
     * @return {Promise} resolved when service exists or timeout occurs. Returns true/false for service existence
     */

  }, {
    key: 'waitForService',
    value: function waitForService(service, timeout) {
      var _this = this;

      service = this._resolve(service);

      var _waitForService = function _waitForService(callback, timeout) {
        setTimeout(function () {
          _this._node.lookupService(service).then(function (resp) {
            callback(true);
          }).catch(function (err, resp) {
            _waitForService(callback, 500);
          });
        }, timeout);
      };

      var waitPromise = new Promise(function (resolve, reject) {
        _waitForService(resolve, 0);
      });

      if (typeof timeout === 'number') {
        var timeoutPromise = new Promise(function (resolve, reject) {
          setTimeout(resolve.bind(null, false), timeout);
        });

        return Promise.race([waitPromise, timeoutPromise]);
      }
      // else
      return waitPromise;
    }
  }, {
    key: 'getMasterUri',
    value: function getMasterUri() {
      return this._node.getMasterUri();
    }

    /**
     * @typedef {Object} TopicList
     * @property {{name: string, type: string}[]} topics Array of topics
     */

    /**
     * Get list of topics that can be subscribed to. This does not return
     * topics that have no publishers.
     *
     * @param {string} subgraph Restrict topic names to match within the
     *                          specified subgraph. Subgraph namespace is
     *                          resolved relative to this node's namespace.
     *                          Will return all names if no subgraph is given.
     * @return {Promise.<TopicList>}
     */

  }, {
    key: 'getPublishedTopics',
    value: function getPublishedTopics() {
      var subgraph = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "";

      return this._node.getPublishedTopics(subgraph);
    }

    /**
     * Retrieve list topic names and their types.
     *
     * @return {Promise.<TopicList>}
     */

  }, {
    key: 'getTopicTypes',
    value: function getTopicTypes() {
      return this._node.getTopicTypes();
    }

    /**
     * @typedef {Object} SystemState
     * @property {{...string:Array.<string>}} publishers An object with topic names as keys and
     * an array of publishers as values
     * @property {{...string:Array.<string>}} subscribers An object with topic names as keys and
     * an array of subscribers as values
     * @property {{...string:Array.<string>}} services An object with service names as keys and
     * an array of providers as values
     */

    /**
     * Retrieve list representation of system state (i.e. publishers,
     * subscribers, and services).
     *
     * @return {Promise.<SystemState>}
     */

  }, {
    key: 'getSystemState',
    value: function getSystemState() {
      return this._node.getSystemState();
    }

    //------------------------------------------------------------------
    // Param Interface
    //------------------------------------------------------------------

  }, {
    key: 'deleteParam',
    value: function deleteParam(key) {
      return this._node.deleteParam(this._resolve(key));
    }
  }, {
    key: 'setParam',
    value: function setParam(key, value) {
      return this._node.setParam(this._resolve(key), value);
    }
  }, {
    key: 'getParam',
    value: function getParam(key) {
      return this._node.getParam(this._resolve(key));
    }
  }, {
    key: 'hasParam',
    value: function hasParam(key) {
      return this._node.hasParam(this._resolve(key));
    }
    //------------------------------------------------------------------
    // Namespacing
    //------------------------------------------------------------------

  }, {
    key: '_resolve',
    value: function _resolve(name) {
      return namespaceUtils.resolve(name, this._namespace, this.getNodeName());
    }
  }]);

  return NodeHandle;
}();

//------------------------------------------------------------------

module.exports = NodeHandle;