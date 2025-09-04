// Accessibility form functionality
export class AccessibilityForm {
  constructor() {
    this.isOpen = false;
    this.currentCallback = null;
    this.formData = {};
  }

  initialize() {
    this.loadFormHTML();
    this.setupEventListeners();
  }

  loadFormHTML() {
    const container = document.getElementById('accessibilityFormContainer');
    if (!container) {
      console.error('Accessibility form container not found');
      return;
    }

    container.innerHTML = `
      <div class="container">
        <div class="header">
          <h1>🌲 Accessibility Survey</h1>
          <p>Help others find accessible outdoor experiences</p>
        </div>

        <form class="form-container accessibility-form" id="accessibilityForm">
          <button type="button" class="btn-secondary" onclick="closeAccessibilityForm()">✖ Close</button>
          
          <div class="section">
            <div class="section-header" onclick="toggleSection(this)">
              <h2>🗺️ Basic Trail Information</h2>
              <span class="toggle-icon">▼</span>
            </div>
            <div class="section-content active">
              <div class="form-row">
                <div class="form-group">
                  <label for="trailName">Trail Name (Required) <span class="required">*</span></label>
                  <input type="text" id="trailName" name="trailName" required>
                </div>
                <div class="form-group">
                  <label for="location">Location/Address (Required) <span class="required">*</span></label>
                  <input type="text" id="location" name="location" required>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="trailLength">Trail Length (km)</label>
                  <input type="number" id="trailLength" name="trailLength" step="0.1" min="0">
                </div>
                <div class="form-group">
                  <label for="estimatedTime">Estimated Duration</label>
                  <select id="estimatedTime" name="estimatedTime">
                    <option value="">Select duration</option>
                    <option value="Under 30 minutes">Under 30 minutes</option>
                    <option value="30-60 minutes">30-60 minutes</option>
                    <option value="1-2 hours">1-2 hours</option>
                    <option value="2-4 hours">2-4 hours</option>
                    <option value="Half day">Half day</option>
                    <option value="Full day">Full day</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-header" onclick="toggleSection(this)">
              <h2>♿ Mobility Accessibility</h2>
              <span class="toggle-icon">▼</span>
            </div>
            <div class="section-content">
              <div class="form-group">
                <label>Wheelchair Accessibility Level</label>
                <div class="radio-group">
                  <div class="radio-item">
                    <input type="radio" id="wheelchairFull" name="wheelchairAccess" value="Fully accessible">
                    <label for="wheelchairFull">Fully accessible</label>
                  </div>
                  <div class="radio-item">
                    <input type="radio" id="wheelchairPartial" name="wheelchairAccess" value="Partially accessible">
                    <label for="wheelchairPartial">Partially accessible</label>
                  </div>
                  <div class="radio-item">
                    <input type="radio" id="wheelchairAssist" name="wheelchairAccess" value="With assistance">
                    <label for="wheelchairAssist">With assistance</label>
                  </div>
                  <div class="radio-item">
                    <input type="radio" id="wheelchairNot" name="wheelchairAccess" value="Not accessible">
                    <label for="wheelchairNot">Not accessible</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-header" onclick="toggleSection(this)">
              <h2>📝 Additional Information</h2>
              <span class="toggle-icon">▼</span>
            </div>
            <div class="section-content">
              <div class="form-group">
                <label for="additionalNotes">Additional accessibility notes</label>
                <textarea id="additionalNotes" name="additionalNotes" placeholder="Please provide additional details about accessibility features, challenges, or recommendations..."></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="surveyorName">Surveyor Name (Optional)</label>
                  <input type="text" id="surveyorName" name="surveyorName">
                </div>
                <div class="form-group">
                  <label for="surveyDate">Survey Date</label>
                  <input type="date" id="surveyDate" name="surveyDate">
                </div>
              </div>
            </div>
          </div>

          <div class="submit-section">
            <button type="submit" class="submit-btn">✅ Save Survey</button>
            <button type="button" class="btn-secondary" onclick="closeAccessibilityForm()">❌ Cancel</button>
            <p style="color: white; margin-top: 15px; opacity: 0.9;">Thank you for helping make nature accessible to everyone!</p>
          </div>
        </form>
      </div>
    `;
  }

  setupEventListeners() {
    const overlay = document.getElementById('accessibilityOverlay');
    if (!overlay) return;

    const form = overlay.querySelector('#accessibilityForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        this.handleFormSubmit(e);
      });

      // Auto-fill survey date
      const surveyDateField = form.querySelector('#surveyDate');
      if (surveyDateField && !surveyDateField.value) {
        surveyDateField.value = new Date().toISOString().split('T')[0];
      }
    }

    // Make toggle function global
    window.toggleSection = this.toggleSection;
  }

  toggleSection(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.toggle-icon');
    
    if (content.classList.contains('active')) {
      content.classList.remove('active');
      content.style.display = 'none';
      icon.classList.remove('rotated');
    } else {
      content.classList.add('active');
      content.style.display = 'block';
      icon.classList.add('rotated');
    }
  }

  handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {};

    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    // Validate required fields
    const requiredFields = ['trailName', 'location'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      alert('Please fill in the required fields: ' + missingFields.join(', '));
      return;
    }

    // Store form data
    this.formData = data;
    localStorage.setItem("accessibilityData", JSON.stringify(data));
    
    console.log('Accessibility survey data:', data);
    alert('Survey saved successfully! Thank you for your contribution.');

    if (this.currentCallback) {
      const callback = this.currentCallback;
      this.currentCallback = null;
      callback(data);
    }

    this.close();
  }

  open(callback) {
    if (this.isOpen) return;

    this.currentCallback = callback;
    this.isOpen = true;

    const overlay = document.getElementById('accessibilityOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
    }

    this.prefillForm();
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.currentCallback = null;

    const overlay = document.getElementById('accessibilityOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  prefillForm() {
    try {
      const savedData = localStorage.getItem('accessibilityData');
      if (!savedData) return;

      const data = JSON.parse(savedData);
      const form = document.getElementById('accessibilityForm');
      if (!form) return;

      Object.entries(data).forEach(([key, value]) => {
        const field = form.elements[key];
        if (field) {
          if (field.type === 'radio') {
            const radio = form.querySelector(`input[name="${key}"][value="${value}"]`);
            if (radio) radio.checked = true;
          } else {
            field.value = value;
          }
        }
      });
    } catch (error) {
      console.error('Failed to prefill form:', error);
    }
  }

  getFormData() {
    return { ...this.formData };
  }
}