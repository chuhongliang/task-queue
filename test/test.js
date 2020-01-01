const taskQueue = require('../lib/task-que')(1000);

taskQueue.push(
	function(task){
		setTimeout(function(){
			console.log('hello task-queue');
			task.done();
		}, 1000);
	},
	function(){
		console.log('task timeout');
	},
	500
)