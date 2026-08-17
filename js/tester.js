let cueData = null;
let questions = [];
let questionIndex = 0;

async function loadCueContent() {
  try {
    const response = await fetch('data/sample.json');
    cueData = await response.json();

    questions = cueData.questionSets.flatMap(set =>
      set.questions.map(question => ({
        ...question,
        passage: set.passage
      }))
    );

    displayQuestion(questionIndex);

  } catch (error) {
    console.error('Error loading cue content:', error);
  }
}

function displayQuestion(index) {
  const cueContent = document.getElementById('cue-content');
  const question = questions[index];

  cueContent.innerHTML = `
    <p class="passage">${question.passage}</p>

    <table class="question-and-choices">
      <tr>
        <td class="left-cell">
          <span class="question-number">${index + 1}. </span>
        </td>

        <td class="right-cell">
          <span class="question-text">${question.question}</span>
        </td>
      </tr>

      <tr>
        <td class="answer-cell"><span class="feedback-area"></span>
        </td>

        <td class="right-cell">
          <div class="choices">
            ${Object.entries(question.choices).map(([letter, choice]) => `
              <button class="choice" data-choice="${letter}">
                <span class="choice-letter">(${letter})</span>
                <span class="choice-text">${choice.text}</span>
              </button>
            `).join('')}
          </div>
        </td>
      </tr>
    </table>
  `;
    document.querySelectorAll('.choice').forEach(button => {
    button.addEventListener('click', () => {
      const selectedChoice = button.dataset.choice;
      const feedbackArea = document.querySelector('.feedback-area');

      if (selectedChoice === question.correct) {
        feedbackArea.textContent = '✓';
      } else {
        feedbackArea.textContent = '✕';
      }
    });
  });
}

loadCueContent();

document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => {
      document.body.classList.remove('preload');
    });
    
    settingsButton.addEventListener('click', () => {
      settingsButton.blur();
      document.getElementById('settingsMenu')?.classList.toggle('show');
    });
});

document.querySelectorAll('.circle-btn').forEach(button => {
  button.addEventListener('touchstart', () => {
    button.classList.add('active');
  });

  const removeActive = () => {
    button.classList.remove('active');
  };

  button.addEventListener('touchend', removeActive);
  button.addEventListener('touchcancel', removeActive);
});
