#!/usr/bin/env node

'use strict'

const rosnodejs = require('rosnodejs');
var io = require('socket.io')(process.env.PORT || 3000);
//rosnodejs.loadAllPackages();
//const nav_msgs = rosnodejs.require('nav_msgs').msg;
const message_handler = require('./src/utils/message_utils.js');
const kittyCommon = require('/home/ubuntu/kitty_ws/devel/share/gennodejs/ros/kitty_common/_index.js');
//const packageUtil = require('./src/utils/messageGeneration/packages.js');
console.log('server started, awaiting client connection');

io.on('connect', function(socket){

  console.log('client connected');

  socket.on('disconnect', function(){
    console.log('client disconnected');
  });
    
  listener(socket);
})


async function listener(socket) {

    // Register node with ROS master
    const rosNode = await rosnodejs.initNode('/listener_node', { onTheFly: true});

    // const kittyCommon = rosnodejs.require('kitty_common');
    // console.log(kittyCommon);
    // this worked ^^^
    
    rosNode.subscribe('/F252t/odometry', 'nav_msgs/Odometry',
        (data) => {
            rosnodejs.log.info('I heard: [' + data.pose.pose.position.x+']');
            socket.emit('move', data.pose.pose);
        },
        {throttleMs: -1}
    );

    rosNode.subscribe('/F252s/motor_thrusts', kittyCommon.msg.MotorCmds,
        (data) => {
            rosnodejs.log.info('I heard: [' + data.motor_cmds +']');
            socket.emit('thrust', data);
        }, 
        {throttleMs: 1000}
    );

    rosNode.subscribe('/F251s/wind', kittyCommon.msg.Vector3_float32_Stamped,
        (data) => {
            rosnodejs.log.info('I heard: [' + data +']');
            socket.emit('wind', data.vector);
        },
        {throttleMs: 1000}
    );

}
