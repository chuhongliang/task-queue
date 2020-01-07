
const EventEmitter = require('events').EventEmitter;

const DEFAULT_TIMEOUT = 3000;
const INIT_ID = 0;
const EVENT_CLOSED = 'closed';
const EVENT_DRAINED = 'drained';

const STATUS_IDLE = 0;
const STATUS_BUSY = 1;
const STATUS_CLOSED = 2;
const STATUS_DRAINED = 3;

class TaskQueue extends EventEmitter {
	constructor(timeout) {
		super();
		EventEmitter.call(this);
		this.timeout = DEFAULT_TIMEOUT;
		if (timeout && timeout > 0) {
			this.timeout = timeout;
		}
		this.status = STATUS_IDLE;
		this.curId = INIT_ID;
		this.queue = [];
	}

	/**
	 * 
	 * @param {*} func new request
	 * @param {*} onTimeout callback when task timeout
	 * @param {*} timeout timeout for current request
	 * @returns true or false
	 */
	push(fu, onTimeout, timeout) {
		if (this.status !== STATUS_IDLE && this.status !== STATUS_BUSY)
			return false;
		if (typeof fu !== 'function') {
			throw new Error('func should be a function.');
		}
		this.queue.push({ fu, onTimeout, timeout });
		if (this.status === STATUS_IDLE) {
			this.status = STATUS_BUSY;
			let self = this;
			process.nextTick(function () {
				self._next(self.curId);
			})
		}
		return true;
	}

	_next(taskId) {
		if (taskId !== this.curId) return;
		if (this.status !== STATUS_BUSY && this.status !== STATUS_CLOSED) return;
		if (this.timerId) {
			clearTimeout(this.timerId);
			this.timerId = undefined;
		}

		let task = this.queue.shift();
		if (!task) {
			if (this.status === STATUS_BUSY) {
				this.status = STATUS_IDLE;
				this.curId++;
				return;
			}
			this.status = STATUS_DRAINED;
			this.emit(EVENT_DRAINED);
			return;
		}

		let self = this;
		task.id = ++this.curId;
		let timeout = task.timeout > 0 ? task.timeout : this.timeout;
		timeout = timeout > 0 ? timeout : DEFAULT_TIMEOUT;
		this.timerId = setTimeout(function () {
			process.nextTick(function () {
				self._next(task.id);
			});
			self.emit('timeout', task);
			if (task.onTimeout) {
				task.onTimeout();
			}
		}, timeout);

		try {
			task.func({
				done: function () {
					let res = task.id === this.curId;
					process.nextTick(function () {
						self._next(task.id);
					})
					return res;
				}
			})
		} catch (err) {
			self.emit('err', err, task);
			process.nextTick(function () {
				self._next(task.id);
			})
		}
	}

	close(force) {
		if (this.status !== STATUS_IDLE && this.status !== STATUS_BUSY)
			return;

		if (force) {
			this.status = STATUS_DRAINED;
			if (this.timerId) {
				clearTimeout(this.timerId);
				this.timerId = undefined;
			}
			this.emit(EVENT_DRAINED);
		} else {
			this.status = STATUS_CLOSED;
			this.emit(EVENT_CLOSED);
		}
	}

}
module.exports = function (timeout) {
	return new TaskQueue(timeout);
}