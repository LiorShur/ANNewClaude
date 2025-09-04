// Timer functionality
export class TimerController {
  constructor() {
    this.startTime = null;
    this.elapsedTime = 0;
    this.timerInterval = null;
    this.isRunning = false;
    this.element = null;
  }

  initialize() {
    this.element = document.getElementById('timer');
    this.updateDisplay();
  }

  start() {
    if (this.isRunning) return;

    this.startTime = Date.now() - this.elapsedTime;
    this.isRunning = true;
    
    this.timerInterval = setInterval(() => {
      this.updateElapsedTime();
      this.updateDisplay();
    }, 1000);
  }

  stop() {
    if (!this.isRunning) return;

    this.clearInterval();
    this.updateElapsedTime();
    this.updateDisplay();
    this.isRunning = false;
  }

  pause() {
    if (!this.isRunning) return;

    this.clearInterval();
    this.updateElapsedTime();
    this.updateDisplay();
  }

  resume() {
    if (this.isRunning) return;

    this.startTime = Date.now() - this.elapsedTime;
    
    this.timerInterval = setInterval(() => {
      this.updateElapsedTime();
      this.updateDisplay();
    }, 1000);
  }

  reset() {
    this.clearInterval();
    this.startTime = null;
    this.elapsedTime = 0;
    this.isRunning = false;
    this.updateDisplay();
  }

  updateElapsedTime() {
    if (this.startTime) {
      this.elapsedTime = Date.now() - this.startTime;
    }
  }

  updateDisplay() {
    if (!this.element) return;

    const totalSeconds = Math.floor(this.elapsedTime / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formatted = `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`;
    this.element.textContent = formatted;
  }

  pad(number) {
    return number.toString().padStart(2, '0');
  }

  clearInterval() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getElapsedTime() {
    this.updateElapsedTime();
    return this.elapsedTime;
  }
}