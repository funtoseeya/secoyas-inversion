//track whatsapp clicks
// Find the WhatsApp button element
const whatsappButton = document.querySelector('.btn-wsp');

// Add an event listener for the button click
whatsappButton.addEventListener('click', function () {
  // Track the event
  gtag('event', 'Boton Whatsapp', {
    'event_category': 'Button',
    'event_label': 'WhatsApp Button'
  });
});



const form = document.querySelector('form');
form.addEventListener('submit', handleSubmit);

function handleSubmit(event) {
  event.preventDefault(); // prevent the default form submit action

  const name = document.querySelector('input[type="text"]').value;
  const email = document.querySelector('input[type="email"]').value;
  const phone = document.querySelector('input[type="tel"]').value;
  const message = document.querySelector('textarea').value;

  // Check if any of the required fields are empty
  if (!name || !email || !phone || !message) {
    alert('Por favor, complete todos los campos.');
    return; // Stop further execution
  } else {
    // create a FormData object to send the form data to the server
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('phone', phone);
    formData.append('message', message);

    // send the form data to the server using an AJAX request
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'submit-form.php');
    xhr.onload = function () {
      if (xhr.status === 200) {
        // Track the form submission success event
        gtag('event', 'form_submission_success', {
          'event_category': 'Form',
          'event_label': 'Contact Form'
        });

        // show a success message to the user
        alert('¡Gracias por su consulta! Nos pondremos en contacto con usted en breve.');

        // clear the form fields
        form.reset();
      } else {
        // handle the error case
        alert('Hubo un error al enviar el formulario. Por favor, inténtelo de nuevo más tarde.');
      }
    };
    xhr.onerror = function () {
      // handle the error case
      alert('Hubo un error al enviar el formulario. Por favor, inténtelo de nuevo más tarde.');
    };
    xhr.send(formData);
  }
}



document.addEventListener('DOMContentLoaded', function () {
  const floatingLinkContainer = document.querySelector('.floating-link-container');
  const closeButton = document.querySelector('.close-button');
  const toast = document.querySelector('.floating-link-toast');

  closeButton.addEventListener('click', function () {
    floatingLinkContainer.style.display = 'none';
  });

  toast.addEventListener('click', function () {
    floatingLinkContainer.style.display = 'none';
  });

});


document.addEventListener('DOMContentLoaded', function () {
  const seeMoreButton = document.getElementById('see-more');
  const hiddenItems = document.querySelectorAll('.hidden');
  let expanded = false;

  function toggleItems() {
      hiddenItems.forEach(item => {
          item.style.display = expanded ? 'none' : 'list-item';
      });
      seeMoreButton.textContent = expanded ? 'Mostrar más' : 'Mostrar menos';
      expanded = !expanded;

      if (!expanded) {
        // Scroll to the item with the ID "propiedad"
        const propiedadItem = document.getElementById('propiedad');
        propiedadItem.scrollIntoView({ behavior: 'smooth' });
    }
  }

  seeMoreButton.addEventListener('click', toggleItems);
});