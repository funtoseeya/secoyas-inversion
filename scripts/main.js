// ─── Navbar scroll effect ────────────────────────────────────────────────────

(function () {
  var header = document.getElementById('site-header');
  if (!header) return;
  window.addEventListener('scroll', function () {
    header.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });
})();


// ─── Mobile burger menu ──────────────────────────────────────────────────────

(function () {
  var burger   = document.getElementById('nav-burger');
  var nav      = document.getElementById('main-nav');
  var closeBtn = document.getElementById('nav-close');
  if (!burger || !nav) return;

  function openNav() {
    nav.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeNav() {
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  burger.addEventListener('click', openNav);
  if (closeBtn) closeBtn.addEventListener('click', closeNav);

  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', closeNav);
  });
})();


// ─── Animated metric counters ─────────────────────────────────────────────────

(function () {
  var cards = document.querySelectorAll('.metric-card[data-target]');
  if (!cards.length || typeof IntersectionObserver === 'undefined') return;

  function formatNumber(val, fmt) {
    if (fmt === 'percent-decimal') {
      // 22.2 → "22,2"
      return val.toFixed(1).replace('.', ',');
    }
    if (fmt === 'percent' || fmt === 'years') {
      return Math.round(val).toString();
    }
    // default "uf": integer with dot thousands separator (Spanish)
    return Math.round(val).toLocaleString('es-CL');
  }

  function animateCard(card) {
    var target  = parseFloat(card.getAttribute('data-target'));
    var fmt     = card.getAttribute('data-format') || 'uf';
    var el      = card.querySelector('.metric-value');
    if (!el) return;

    var duration = 1500;
    var start    = null;

    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = formatNumber(eased * target, fmt);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = formatNumber(target, fmt);
      }
    }
    requestAnimationFrame(step);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateCard(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });

  cards.forEach(function (card) { observer.observe(card); });
})();


// ─── Swiper testimonials carousel ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  if (typeof Swiper === 'undefined') return;
  new Swiper('.testimonials-swiper', {
    slidesPerView: 1,
    spaceBetween: 24,
    autoHeight: false,
    autoplay: { delay: 5000, pauseOnMouseEnter: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
    pagination: { el: '.swiper-pagination', clickable: true },
    breakpoints: {
      768:  { slidesPerView: 2 },
      1024: { slidesPerView: 3 }
    }
  });
});


// ─── Toast notifications ────────────────────────────────────────────────────

function showToast(message, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-notification toast-' + type;
  toast.innerHTML =
    '<span class="toast-message">' + message + '</span>' +
    '<button class="toast-close" aria-label="Cerrar">&times;</button>';

  container.appendChild(toast);

  toast.querySelector('.toast-close').addEventListener('click', function () {
    dismissToast(toast);
  });

  // Auto-dismiss after 6 seconds
  setTimeout(function () {
    dismissToast(toast);
  }, 6000);
}

function dismissToast(toast) {
  toast.classList.add('toast-fade-out');
  toast.addEventListener('animationend', function () {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  });
}


// ─── WhatsApp click tracking ─────────────────────────────────────────────────

const whatsappButton = document.querySelector('.btn-wsp');
if (whatsappButton) {
  whatsappButton.addEventListener('click', function () {
    if (typeof gtag === 'function') {
      gtag('event', 'Boton Whatsapp', {
        event_category: 'Button',
        event_label: 'WhatsApp Button'
      });
    }
  });
}


// ─── Contact form ────────────────────────────────────────────────────────────

const form = document.querySelector('form');
const submitBtn = document.getElementById('contact-submit');

if (form && submitBtn) {
  form.addEventListener('submit', handleSubmit);
}

function handleSubmit(event) {
  event.preventDefault();

  const nameEl    = document.getElementById('contact-name');
  const emailEl   = document.getElementById('contact-email');
  const phoneEl   = document.getElementById('contact-phone');
  const messageEl = document.getElementById('contact-message');

  const name    = nameEl    ? nameEl.value.trim()    : '';
  const email   = emailEl   ? emailEl.value.trim()   : '';
  const phone   = phoneEl   ? phoneEl.value.trim()   : '';
  const message = messageEl ? messageEl.value.trim() : '';

  // Clear previous validation state
  [nameEl, emailEl, phoneEl, messageEl].forEach(function (el) {
    if (el) el.classList.remove('is-invalid');
  });

  let valid = true;

  if (!name)    { if (nameEl)    nameEl.classList.add('is-invalid');    valid = false; }
  if (!phone)   { if (phoneEl)   phoneEl.classList.add('is-invalid');   valid = false; }
  if (!message) { if (messageEl) messageEl.classList.add('is-invalid'); valid = false; }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!email || !emailOk) {
    if (emailEl) emailEl.classList.add('is-invalid');
    valid = false;
  }

  if (!valid) {
    showToast('Por favor, complete todos los campos correctamente.', 'error');
    return;
  }

  // Loading state
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Enviando…';

  const formData = new FormData();
  formData.append('name', name);
  formData.append('email', email);
  formData.append('phone', phone);
  formData.append('message', message);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'submit-form.php');

  xhr.onload = function () {
    restoreSubmitBtn();
    let data = {};
    try { data = JSON.parse(xhr.responseText); } catch (e) { /* ignore */ }

    if (xhr.status === 200 && data.success !== false) {
      if (typeof gtag === 'function') {
        gtag('event', 'form_submission_success', {
          event_category: 'Form',
          event_label: 'Contact Form'
        });
      }
      showToast('¡Gracias por su consulta! Nos pondremos en contacto con usted en breve.', 'success');
      form.reset();
      [nameEl, emailEl, phoneEl, messageEl].forEach(function (el) {
        if (el) el.classList.remove('is-invalid');
      });
    } else {
      showToast('Hubo un error al enviar el formulario. Por favor, inténtelo de nuevo más tarde.', 'error');
    }
  };

  xhr.onerror = function () {
    restoreSubmitBtn();
    showToast('No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.', 'error');
  };

  xhr.send(formData);
}

function restoreSubmitBtn() {
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Solicitar contacto</span>';
  }
}


// ─── Floating banner close (if present) ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  const floatingLinkContainer = document.querySelector('.floating-link-container');
  const closeButton = document.querySelector('.close-button');
  const toast = document.querySelector('.floating-link-toast');

  if (closeButton && floatingLinkContainer) {
    closeButton.addEventListener('click', function () {
      floatingLinkContainer.style.display = 'none';
    });
  }
  if (toast && floatingLinkContainer) {
    toast.addEventListener('click', function () {
      floatingLinkContainer.style.display = 'none';
    });
  }
});


// ─── Show more / show less (El Negocio) ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  const seeMoreButton = document.getElementById('see-more');
  const hiddenItems = document.querySelectorAll('.hidden');
  if (!seeMoreButton || hiddenItems.length === 0) return;

  let expanded = false;

  function toggleItems() {
    hiddenItems.forEach(function (item) {
      item.style.display = expanded ? 'none' : 'list-item';
    });
    seeMoreButton.textContent = expanded ? 'Mostrar más' : 'Mostrar menos';
    seeMoreButton.setAttribute('aria-expanded', !expanded);
    expanded = !expanded;

    if (!expanded) {
      const propiedadItem = document.getElementById('propiedad');
      if (propiedadItem) propiedadItem.scrollIntoView({ behavior: 'smooth' });
    }
  }

  seeMoreButton.addEventListener('click', toggleItems);
});


// ─── Active nav link on scroll (IntersectionObserver) ────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.main-nav .nav-link-item[href^="#"]');

  if (!sections.length || !navLinks.length) return;

  function setActiveLink(id) {
    navLinks.forEach(function (link) {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === '#' + id);
    });
  }

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        setActiveLink(entry.target.id);
      }
    });
  }, {
    rootMargin: '-30% 0px -60% 0px',
    threshold: 0
  });

  sections.forEach(function (section) {
    observer.observe(section);
  });
});


// ─── AOS (Animate On Scroll) initialisation ───────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 800, once: true, easing: 'ease-out-quad' });
  }
});
