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

var ros_msg_utils = require('../ros_msg_utils');
var base_serializers = ros_msg_utils.Serialize;
var base_deserializers = ros_msg_utils.Deserialize;

//-----------------------------------------------------------------------

var callerIdPrefix = 'callerid=';
var md5Prefix = 'md5sum=';
var topicPrefix = 'topic=';
var servicePrefix = 'service=';
var typePrefix = 'type=';
var latchingPrefix = 'latching=';
var persistentPrefix = 'persistent=';
var errorPrefix = 'error=';
var messageDefinitionPrefix = 'message_definition=';

//-----------------------------------------------------------------------

function serializeStringFields(fields) {
  var length = 0;
  fields.forEach(function (field) {
    length += field.length + 4;
  });
  var buffer = new Buffer(4 + length);
  var offset = base_serializers.uint32(length, buffer, 0);

  fields.forEach(function (field) {
    offset = base_serializers.string(field, buffer, offset);
  });
  return buffer;
}

function deserializeStringFields(buffer) {
  var fields = [];
  var offset = [0];
  while (offset[0] < buffer.length) {
    var str = base_deserializers.string(buffer, offset);
    fields.push(str);
  }

  return fields;
}

/**
 * NOTE for general questions see
 * http://wiki.ros.org/ROS/TCPROS
 */
var TcprosUtils = {
  createSubHeader: function createSubHeader(callerId, md5sum, topic, type, messageDefinition) {
    var fields = [callerIdPrefix + callerId, md5Prefix + md5sum, topicPrefix + topic, typePrefix + type, messageDefinitionPrefix + messageDefinition];
    return serializeStringFields(fields);
  },


  /**
   * Creates a TCPROS connection header for a publisher to send.
   * @param callerId {string} node publishing this topic
   * @param md5sum {string} md5 of the message
   * @param type {string} type of the message
   * @param latching {number} 0 or 1 indicating if the topic is latching
   * @param messageDefinition {string} trimmed message definition.
   *          rosbag relies on this being sent although it is not mentioned in the spec.
   *
   */
  createPubHeader: function createPubHeader(callerId, md5sum, type, latching, messageDefinition) {
    var fields = [callerIdPrefix + callerId, md5Prefix + md5sum, typePrefix + type, latchingPrefix + latching, messageDefinitionPrefix + messageDefinition];
    return serializeStringFields(fields);
  },
  createServiceClientHeader: function createServiceClientHeader(callerId, service, md5sum, type, persistent) {
    var fields = [callerIdPrefix + callerId, servicePrefix + service, md5Prefix + md5sum];

    if (persistent) {
      fields.push(persistentPrefix + '1');
    }
    return serializeStringFields(fields);
  },
  createServiceServerHeader: function createServiceServerHeader(callerId, md5sum, type) {
    var fields = [callerIdPrefix + callerId, md5Prefix + md5sum, typePrefix + type];
    return serializeStringFields(fields);
  },
  parseTcpRosHeader: function parseTcpRosHeader(header) {
    var info = {};

    var fields = deserializeStringFields(header);
    fields.forEach(function (field) {
      var matchResult = field.match(/^(\w+)=([\s\S]+)/);

      // invalid connection header
      if (!matchResult) {
        console.error('Invalid connection header while parsing field %s', field);
        return null;
      }
      // else
      info[matchResult[1]] = matchResult[2];
    });

    return info;
  },
  parseSubHeader: function parseSubHeader(header) {
    var info = {};
    var fields = deserializeStringFields(header);
    fields.forEach(function (field) {

      if (field.startsWith(md5Prefix)) {
        info.md5sum = field.substr(md5Prefix.length);
      } else if (field.startsWith(topicPrefix)) {
        info.topic = field.substr(topicPrefix.length);
      } else if (field.startsWith(callerIdPrefix)) {
        info.callerId = field.substr(callerIdPrefix.length);
      } else if (field.startsWith(typePrefix)) {
        info.type = field.substr(typePrefix.length);
      }
    });
    return info;
  },
  parsePubHeader: function parsePubHeader(header) {
    var info = {};
    var fields = deserializeStringFields(header);
    fields.forEach(function (field) {

      if (field.startsWith(md5Prefix)) {
        info.md5sum = field.substr(md5Prefix.length);
      } else if (field.startsWith(latchingPrefix)) {
        info.latching = field.substr(latchingPrefix.length);
      } else if (field.startsWith(callerIdPrefix)) {
        info.callerId = field.substr(callerIdPrefix.length);
      } else if (field.startsWith(typePrefix)) {
        info.type = field.substr(typePrefix.length);
      }
    });
    return info;
  },
  parseServiceClientHeader: function parseServiceClientHeader(header) {
    var info = {};
    var fields = deserializeStringFields(header);
    fields.forEach(function (field) {

      if (field.startsWith(md5Prefix)) {
        info.md5sum = field.substr(md5Prefix.length);
      } else if (field.startsWith(servicePrefix)) {
        info.service = field.substr(servicePrefix.length);
      } else if (field.startsWith(callerIdPrefix)) {
        info.callerId = field.substr(callerIdPrefix.length);
      } else if (field.startsWith(typePrefix)) {
        info.type = field.substr(typePrefix.length);
      }
    });
    return info;
  },
  parseServiceServerHeader: function parseServiceServerHeader(header) {
    var info = {};
    var fields = deserializeStringFields(header);
    fields.forEach(function (field) {

      if (field.startsWith(md5Prefix)) {
        info.md5sum = field.substr(md5Prefix.length);
      } else if (field.startsWith(callerIdPrefix)) {
        info.callerId = field.substr(callerIdPrefix.length);
      } else if (field.startsWith(typePrefix)) {
        info.type = field.substr(typePrefix.length);
      }
    });
    return info;
  },
  validateSubHeader: function validateSubHeader(header, topic, type, md5sum) {
    if (!header.hasOwnProperty('topic')) {
      return this.serializeString('Connection header missing expected field [topic]');
    } else if (!header.hasOwnProperty('type')) {
      return this.serializeString('Connection header missing expected field [type]');
    } else if (!header.hasOwnProperty('md5sum')) {
      return this.serializeString('Connection header missing expected field [md5sum]');
    } else if (header.topic !== topic) {
      return this.serializeString('Got incorrect topic [' + header.topic + '] expected [' + topic + ']');
    }
    // rostopic will send '*' for some commands (hz)
    else if (header.type !== type && header.type !== '*') {
        return this.serializeString('Got incorrect message type [' + header.type + '] expected [' + type + ']');
      } else if (header.md5sum !== md5sum && header.md5sum !== '*') {
        return this.serializeString('Got incorrect md5sum [' + header.md5sum + '] expected [' + md5sum + ']');
      }
    // else
    return null;
  },
  validatePubHeader: function validatePubHeader(header, type, md5sum) {
    if (!header.hasOwnProperty('type')) {
      return this.serializeString('Connection header missing expected field [type]');
    } else if (!header.hasOwnProperty('md5sum')) {
      return this.serializeString('Connection header missing expected field [md5sum]');
    }
    // rostopic will send '*' for some commands (hz)
    else if (header.type !== type && header.type !== '*') {
        return this.serializeString('Got incorrect message type [' + header.type + '] expected [' + type + ']');
      } else if (header.md5sum !== md5sum && header.md5sum !== '*') {
        return this.serializeString('Got incorrect md5sum [' + header.md5sum + '] expected [' + md5sum + ']');
      }
    // else
    return null;
  },
  validateServiceClientHeader: function validateServiceClientHeader(header, service, md5sum) {
    if (!header.hasOwnProperty('service')) {
      return 'Connection header missing expected field [service]';
    } else if (!header.hasOwnProperty('md5sum')) {
      return 'Connection header missing expected field [md5sum]';
    } else if (header.service !== service) {
      return 'Got incorrect service [' + header.service + '] expected [' + service + ']';
    } else if (header.md5sum !== md5sum && header.md5sum !== '*') {
      return 'Got incorrect md5sum [' + header.md5sum + '] expected [' + md5sum + ']';
    }
  },
  serializeMessage: function serializeMessage(MessageClass, message) {
    var prependMessageLength = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

    var msgSize = MessageClass.getMessageSize(message);
    var msgBuffer = void 0;
    var offset = 0;
    if (prependMessageLength) {
      msgBuffer = new Buffer(msgSize + 4);
      offset = base_serializers.uint32(msgSize, msgBuffer, 0);
    } else {
      msgBuffer = new Buffer(msgSize);
    }

    MessageClass.serialize(message, msgBuffer, offset);
    return msgBuffer;
  },
  serializeServiceResponse: function serializeServiceResponse(ResponseClass, response, success) {
    var prependResponseInfo = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

    var responseBuffer = void 0;
    if (prependResponseInfo) {
      if (success) {
        var respSize = ResponseClass.getMessageSize(response);
        responseBuffer = new Buffer(respSize + 5);

        // add the success byte
        base_serializers.uint8(1, responseBuffer, 0);
        // add the message length
        base_serializers.uint32(respSize, responseBuffer, 1);
        ResponseClass.serialize(response, responseBuffer, 5);
      } else {
        var errorMessage = 'Unable to handle service call';
        var errLen = errorMessage.length;
        // FIXME: check that we don't need the extra 4 byte message len here
        responseBuffer = new Buffer(5 + errLen);
        base_serializers.uint8(0, responseBuffer, 0);
        base_serializers.string(errorMessage, responseBuffer, 1);
      }
    } else {
      responseBuffer = new Buffer(ResponseClass.getMessageSize(response));
    }

    return responseBuffer;
  },
  deserializeMessage: function deserializeMessage(MessageClass, messageBuffer) {
    return MessageClass.deserialize(messageBuffer, [0]);
  },
  serializeString: function serializeString(str) {
    var buf = new Buffer(str.length + 4);
    base_serializers.string(str, buf, 0);
    return buf;
  },
  deserializeString: function deserializeString(buffer) {
    return base_deserializers.string(buffer, [0]);
  },
  createTcpRosError: function createTcpRosError(str) {
    return this.serializeString('{errorPrefix}' + str);
  }
};

//-----------------------------------------------------------------------

module.exports = TcprosUtils;