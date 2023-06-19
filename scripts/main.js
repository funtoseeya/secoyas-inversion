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
      // show a success message to the user
      alert('¡Gracias por su consulta! Nos pondremos en contacto con usted en breve.');
      // clear the form fields
      form.reset();
    };
    xhr.onerror = function () {
      // handle the error case
      alert('Hubo un error al enviar el formulario. Por favor, inténtelo de nuevo más tarde.');
    };
    xhr.send(formData);
  }
}
