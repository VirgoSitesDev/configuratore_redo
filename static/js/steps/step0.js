import { configurazione } from '../config.js';
import { updateProgressBar } from '../utils.js';

export function initStep0Listeners() {
  $('.modalita-card').on('click', function() {
    $('.modalita-card').removeClass('selected');
    $(this).addClass('selected');
    
    configurazione.modalitaConfigurazione = $(this).data('modalita');
    $('#btn-continua-scelta-modalita').prop('disabled', false);
  });

  $('#btn-continua-scelta-modalita').on('click', function(e) {
    e.preventDefault();
    
    if (configurazione.modalitaConfigurazione === 'profilo_strip') {
      $("#step0-scelta-modalita").fadeOut(300, function() {
        $("#step1-tipologia").fadeIn(300);
        updateProgressBar(1);
        initStep2bTipologiaListeners();
      });
    } else if (configurazione.modalitaConfigurazione === 'solo_strip') {
      $("#step0-scelta-modalita").fadeOut(300, function() {
        $("#step2b-tipologia-strip").fadeIn(300);
        updateProgressBar(2);
        initStep2bTipologiaListeners();
      });
    }
  });
}

export function initStep2bTipologiaListeners() {
  caricaTipologieDalDatabase();

  $('#btn-torna-step0-da-tipologia').on('click', function(e) {
    e.preventDefault();
    $("#step2b-tipologia-strip").fadeOut(300, function() {
      goToHomepage();
    });
  });
  
  $('#btn-continua-tipologia-step2b').on('click', function(e) {
    e.preventDefault();
    $("#step2b-tipologia-strip").fadeOut(300, function() {
      $("#step2b-parametri").fadeIn(300);
      updateProgressBar(3);
      initStep2bParametriListeners();
    });
  });
}

function caricaTipologieDalDatabase() {
  $('#step2b-tipologia-container').html('<div class="text-center"><div class="spinner-border"></div><p>Caricamento tipologie...</p></div>');
  
  $.ajax({
    url: '/get_tipologie_strip_disponibili',
    method: 'GET',
    success: function(data) {
      if (data.success && data.tipologie) {
        renderTipologie(data.tipologie);
      } else {
        console.error('❌ Errore nel caricamento tipologie:', data.message);
        renderTipologieDefault();
      }
    },
    error: function(xhr, status, error) {
      console.error('❌ Errore AJAX tipologie:', error);
      renderTipologieDefault();
    }
  });
}

export { caricaTipologieDalDatabase };

function renderTipologie(tipologie) {
  const tipologieContainer = $('#step2b-tipologia-container');
  tipologieContainer.empty();

  const tipologieInfo = {
    'COB': {
      img: '/static/img/strip-cob.jpg',
      nome: 'COB',
      descrizione: 'Strip LED con tecnologia Chip On Board'
    },
    'SMD': {
      img: '/static/img/strip-smd.jpg',
      nome: 'SMD', 
      descrizione: 'Strip LED con tecnologia Surface Mount Device'
    },
    'SPECIAL': {
      img: '/static/img/strip-special.jpg',
      nome: 'SPECIAL STRIP',
      descrizione: 'Strip LED con caratteristiche speciali'
    }
  };

  const ordineDesiderato = ['COB', 'SMD', 'SPECIAL'];
  const tipologieOrdinate = ordineDesiderato.filter(tip => tipologie.includes(tip));
  
  tipologieOrdinate.forEach(function(tipologia) {
    const info = tipologieInfo[tipologia] || {
      img: '/static/img/placeholder_logo.jpg',
      nome: tipologia,
      descrizione: `Strip LED ${tipologia}`
    };
    
    tipologieContainer.append(`
      <div class="col-md-4 mb-3">
        <div class="card option-card step2b-tipologia-card" data-tipologia="${tipologia}">
          <img src="${info.img}" class="card-img-top" alt="${info.nome}" 
               style="height: 180px; object-fit: cover;" 
               onerror="this.src='/static/img/placeholder_logo.jpg'; this.style.height='180px'">
          <div class="card-body text-center">
            <h5 class="card-title">${info.nome}</h5>
            <p class="card-text small text-muted">${info.descrizione}</p>
          </div>
        </div>
      </div>
    `);
  });

  $('.step2b-tipologia-card').on('click', function() {
    $('.step2b-tipologia-card').removeClass('selected');
    $(this).addClass('selected');

    configurazione.tipologiaStripSelezionata = $(this).data('tipologia');

    // Clear previous strip selection when changing tipologia
    configurazione.stripLedSceltaFinale = null;
    configurazione.stripLedSelezionata = null;
    configurazione.nomeCommercialeStripLed = null;

    // Clear parameters when changing tipologia
    configurazione.tensioneSelezionato = null;
    configurazione.ipSelezionato = null;
    configurazione.temperaturaSelezionata = null;
    configurazione.potenzaSelezionata = null;

    // Hide downstream sections
    $('#step2b-parametri-strip').hide();
    $('#step2b-potenza-strip').hide();
    $('#step2b-strip-selection').hide();

    if (configurazione.tipologiaStripSelezionata === 'SPECIAL') {
      caricaSpecialStripDalDatabase();
      $('#btn-continua-tipologia-step2b').prop('disabled', true);
    } else {
      $('#step2b-special-container').hide();
      configurazione.specialStripSelezionata = null;
      $('#btn-continua-tipologia-step2b').prop('disabled', false);
    }
  });
}

function renderTipologieDefault() {
  renderTipologie(['COB', 'SMD', 'SPECIAL']);
}

function caricaSpecialStripDalDatabase() {
  $('#step2b-special-container').show();
  $('#step2b-special-container .row').html('<div class="col-12 text-center"><div class="spinner-border"></div><p>Caricamento special strip...</p></div>');
  
  $.ajax({
    url: '/get_special_strip_disponibili',
    method: 'GET',
    success: function(data) {
      if (data.success && data.special_strips) {
        renderSpecialStrip(data.special_strips);
      } else {
        console.error('❌ Errore nel caricamento special strip:', data.message);
        renderSpecialStripDefault();
      }
    },
    error: function(xhr, status, error) {
      console.error('❌ Errore AJAX special strip:', error);
      renderSpecialStripDefault();
    }
  });
}

function renderSpecialStrip(specialStrips) {
  const specialContainer = $('#step2b-special-container .row');
  specialContainer.empty();

  const specialInfo = {
    'XFLEX': {
      nome: 'XFLEX',
      descrizione: 'Strip LED flessibile'
    },
    'XSNAKE': {
      nome: 'XSNAKE',
      descrizione: 'Strip LED con design a serpente'
    },
    'XMAGIS': {
      nome: 'XMAGIS',
      descrizione: 'Strip LED premium'
    },
    'ZIG_ZAG': {
      nome: 'ZIG ZAG',
      descrizione: 'Strip LED con configurazione a zig zag'
    }
  };
  
  specialStrips.forEach(function(special) {
    const info = specialInfo[special] || {
      nome: special,
      descrizione: `Strip LED ${special}`
    };
    
    specialContainer.append(`
      <div class="col-md-4 mb-3">
        <div class="card option-card step2b-special-card" data-special="${special}">
          <div class="card-body text-center">
            <h5 class="card-title">${info.nome}</h5>
            <p class="card-text small text-muted">${info.descrizione}</p>
          </div>
        </div>
      </div>
    `);
  });

  $('.step2b-special-card').on('click', function() {
    $('.step2b-special-card').removeClass('selected');
    $(this).addClass('selected');
    
    configurazione.specialStripSelezionata = $(this).data('special');
    $('#btn-continua-tipologia-step2b').prop('disabled', false);
  });

  if (specialStrips.length === 1) {
    setTimeout(() => {
      $('.step2b-special-card').first().click();
    }, 100);
  }
}

function renderSpecialStripDefault() {
  renderSpecialStrip(['XFLEX', 'XSNAKE', 'XMAGIS', 'ZIG_ZAG']);
}

function initStep2bParametriListeners() {
  caricaOpzioniStep2b();

  $('#btn-torna-tipologia-step2b').on('click', function(e) {
    e.preventDefault();
    $("#step2b-parametri").fadeOut(300, function() {
      $("#step2b-tipologia-strip").fadeIn(300);
      updateProgressBar(2);
    });
  });

  $('#btn-continua-parametri-step2b').on('click', function(e) {
    e.preventDefault();
    
    if (checkStep2bParametriCompletion()) {
      $("#step2b-parametri").fadeOut(300, function() {
        $("#step2b-potenza-lunghezza").fadeIn(300);
        updateProgressBar(3);
        initStep2bPotenzaListeners();
      });
    }
  });
}

function initStep2bPotenzaListeners() {

  caricaOpzioniPotenzaStep2b();

  $(document).off('click', '.potenza-card').on('click', '.potenza-card', function() {
    $('.potenza-card').removeClass('selected');
    $(this).addClass('selected');
    configurazione.potenzaSelezionata = $(this).data('potenza');

    caricaStripLedPerSoloStrip();
    checkStep2bPotenzaCompletion();
  });

  $(document).off('click', '.step2b-strip-led-card').on('click', '.step2b-strip-led-card', function() {
    $('.step2b-strip-led-card').removeClass('selected');
    $(this).addClass('selected');

    const stripId = $(this).data('strip-id');
    const nomeCommerciale = $(this).data('nome-commerciale') || '';
    const lunghezzaMassima = $(this).data('lunghezza-massima') || 5000;
    const giuntabile = $(this).data('giuntabile');

    configurazione.stripLedSceltaFinale = stripId;
    configurazione.nomeCommercialeStripLed = nomeCommerciale;
    configurazione.stripLedSelezionata = stripId;
    configurazione.lunghezzaMassimaStripLed = lunghezzaMassima;
    configurazione.stripGiuntabile = giuntabile !== undefined ? giuntabile : true;

    // Show and setup length input after strip selection
    $('#step2b-lunghezza-container').show();
    setupLengthValidation();

    checkStep2bPotenzaCompletion();
  });

  function setupLengthValidation() {
    $('#step2b-lunghezza-strip').off('input').on('input', function() {
      let lunghezza = parseFloat($(this).val()) || null;

      if (lunghezza) {
        // Validate against max length if strip is not giuntabile
        if (configurazione.stripGiuntabile === false && configurazione.lunghezzaMassimaStripLed) {
          if (lunghezza > configurazione.lunghezzaMassimaStripLed) {
            alert(`ATTENZIONE: La lunghezza massima per questa strip LED è ${configurazione.lunghezzaMassimaStripLed}mm (${configurazione.lunghezzaMassimaStripLed/1000}m). La strip non è giuntabile.`);
            $(this).val(configurazione.lunghezzaMassimaStripLed);
            lunghezza = configurazione.lunghezzaMassimaStripLed;
          }
        }

        configurazione.lunghezzaRichiestaMetri = lunghezza / 1000;
        configurazione.lunghezzaRichiesta = lunghezza;
      } else {
        configurazione.lunghezzaRichiestaMetri = null;
        configurazione.lunghezzaRichiesta = null;
      }

      checkStep2bPotenzaCompletion();
    });

    // Set max attribute if not giuntabile
    if (configurazione.stripGiuntabile === false && configurazione.lunghezzaMassimaStripLed) {
      $('#step2b-lunghezza-strip').attr('max', configurazione.lunghezzaMassimaStripLed);
    } else {
      $('#step2b-lunghezza-strip').removeAttr('max');
    }
  }

  $('#btn-torna-parametri-step2b').on('click', function(e) {
    e.preventDefault();
    $("#step2b-potenza-lunghezza").fadeOut(300, function() {
      $("#step2b-parametri").fadeIn(300);
      updateProgressBar(3);
    });
  });

  $('#btn-continua-potenza-step2b').on('click', function(e) {
    e.preventDefault();
    
    if (checkStep2bPotenzaCompletion()) {
      $(this).prop('disabled', true).text('Configurazione in corso...');

      setTimeout(() => {
        configurazione.modalitaConfigurazione = 'solo_strip';
        configurazione.profiloSelezionato = null;
        configurazione.tipologiaSelezionata = 'taglio_misura';
        configurazione.categoriaSelezionata = 'solo_strip';
        configurazione.nomeModello = 'Solo Strip LED';

        import('./step4.js').then(module => {
          $("#step2b-potenza-lunghezza").fadeOut(300, function() {
            module.vaiAllAlimentazione();
          });
        });
      }, 1000);
    }
  });
}

function caricaOpzioniStep2b() {
  $('#step2b-tensione-options').html('<div class="text-center"><div class="spinner-border"></div><p>Caricamento...</p></div>');
  $('#step2b-ip-options').empty();
  $('#step2b-temperatura-options').empty();
  
  configurazione.tensioneSelezionato = null;
  configurazione.ipSelezionato = null;
  configurazione.temperaturaSelezionata = null;
  
  $('#btn-continua-parametri-step2b').prop('disabled', true);

  $.ajax({
    url: '/get_opzioni_strip_standalone',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      tipologia: configurazione.tipologiaStripSelezionata,
      special: configurazione.specialStripSelezionata
    }),
    success: function(data) {
      if (data.success) {
        renderOpzioniTensione(data.tensioni);
      } else {
        console.error('❌ Errore nella risposta tensioni:', data);
        $('#step2b-tensione-options').html('<p class="text-danger">Errore nel caricamento delle opzioni.</p>');
      }
    },
    error: function(xhr, status, error) {
      console.error('❌ Errore AJAX tensioni:', xhr.responseText);
      $('#step2b-tensione-options').html('<p class="text-danger">Errore nel caricamento delle opzioni.</p>');
    }
  });
}

function renderOpzioniTensione(tensioni) {
  $('#step2b-tensione-options').empty();
  
  const mappaTensione = {
    '24V': '24V',
    '48V': '48V', 
    '220V': '220V'
  };
  
  tensioni.forEach(function(tensione) {
    const nomeVisualizzato = mappaTensione[tensione] || tensione;
    $('#step2b-tensione-options').append(`
      <div class="col-md-4 mb-3">
        <div class="card option-card tensione-card" data-tensione="${tensione}">
          <div class="card-body text-center">
            <h5 class="card-title">${nomeVisualizzato}</h5>
          </div>
        </div>
      </div>
    `);
  });

  if (tensioni.length === 1) {
    setTimeout(() => {
      $('.tensione-card').addClass('selected');
      configurazione.tensioneSelezionato = tensioni[0];
      caricaOpzioniIP();
    }, 100);
  }
  
  $('.tensione-card').on('click', function() {
    $('.tensione-card').removeClass('selected');
    $(this).addClass('selected');
    configurazione.tensioneSelezionato = $(this).data('tensione');

    caricaOpzioniIP();
  });
}

function caricaOpzioniIP() {
  $('#step2b-ip-options').html('<div class="text-center"><div class="spinner-border"></div></div>');
  
  $.ajax({
    url: '/get_opzioni_ip_standalone',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      tipologia: configurazione.tipologiaStripSelezionata,
      tensione: configurazione.tensioneSelezionato,
      special: configurazione.specialStripSelezionata
    }),
    success: function(data) {
      if (data.success) {
        const opzioniIP = data.gradi_ip || data.ip_options || data.ip || [];
        renderOpzioniIP(opzioniIP);
      } else {
        $('#step2b-ip-options').html('<p class="text-danger">Errore nel caricamento delle opzioni IP.</p>');
      }
    },
    error: function(xhr, status, error) {
      console.error('Errore AJAX IP:', {
        status: status,
        error: error,
        responseText: xhr.responseText
      });
      $('#step2b-ip-options').html('<p class="text-danger">Errore nella chiamata API per le opzioni IP.</p>');
    }
  });
}

export function renderOpzioniIP(opzioniIP) {
  $('#step2b-ip-options').empty();

  if (!opzioniIP || !Array.isArray(opzioniIP) || opzioniIP.length === 0) {
    console.warn('Opzioni IP non valide o vuote:', opzioniIP);
    $('#step2b-ip-options').html(`
      <div class="col-12">
        <div class="alert alert-warning">
          <p>Nessuna opzione IP disponibile per questa configurazione.</p>
          <p>Debug: ${JSON.stringify(opzioniIP)}</p>
        </div>
      </div>
    `);
    return;
  }
  
  const mappaIP = {
    'IP20': 'IP20 (Interni)',
    'IP65': 'IP65 (Resistente all\'umidità)',
    'IP66': 'IP66 (Resistente all\'acqua)',
    'IP67': 'IP67 (Esterni)'
  };
  
  opzioniIP.forEach(function(ip) {
    const nomeVisualizzato = mappaIP[ip] || ip;
    $('#step2b-ip-options').append(`
      <div class="col-md-4 mb-3">
        <div class="card option-card ip-card" data-ip="${ip}">
          <div class="card-body text-center">
            <h5 class="card-title">${nomeVisualizzato}</h5>
          </div>
        </div>
      </div>
    `);
  });

  if (opzioniIP.length === 1) {
    setTimeout(() => {
      $('.ip-card').addClass('selected');
      configurazione.ipSelezionato = opzioniIP[0];
      caricaOpzioniTemperatura();
    }, 100);
  }
  
  $('.ip-card').on('click', function() {
    $('.ip-card').removeClass('selected');
    $(this).addClass('selected');
    configurazione.ipSelezionato = $(this).data('ip');

    caricaOpzioniTemperatura();
  });
}

function caricaOpzioniTemperatura() {
  $('#step2b-temperatura-options').html('<div class="text-center"><div class="spinner-border"></div></div>');
  
  $.ajax({
    url: '/get_opzioni_temperatura_standalone',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      tipologia: configurazione.tipologiaStripSelezionata,
      tensione: configurazione.tensioneSelezionato,
      ip: configurazione.ipSelezionato,
      special: configurazione.specialStripSelezionata,
      categoria: 'solo_strip'
    }),
    success: function(data) {
      if (data.success) {
        renderOpzioniTemperatura(data.temperature);
      } else {
        console.error('Errore nella risposta Temperatura:', data);
        $('#step2b-temperatura-options').html('<p class="text-danger">Errore nel caricamento delle temperature.</p>');
      }
    },
    error: function(xhr, status, error) {
      console.error('Errore AJAX Temperatura:', xhr.responseText);
      $('#step2b-temperatura-options').html('<p class="text-danger">Errore nella chiamata API per le temperature.</p>');
    }
  });
}

function renderOpzioniTemperatura(temperature) {
  $('#step2b-temperatura-options').empty();
  
  const mappaTemperatura = {
    '2700K': '2700K',
    '3000K': '3000K',
    '4000K': '4000K',
    '6000K': '6000K',
    '6500K': '6500K',
    'CCT': 'CCT',
    'RGB': 'RGB',
    'RGBW': 'RGBW'
  };
  
  const mappaColori = {
    '2700K': '#FFE9C0',
    '3000K': '#FFF1D9',
    '4000K': '#FFFBE3',
    '6000K': '#F5FBFF',
    '6500K': '#F5FBFF',
    'CCT': 'linear-gradient(to right, #FFE9C0, #F5FBFF)',
    'RGB': 'linear-gradient(to right, red, green, blue)',
    'RGBW': 'linear-gradient(to right, red, green, blue, white)'
  };
  
  temperature.forEach(function(temp) {
    const nomeVisualizzato = mappaTemperatura[temp] || temp;
    const colore = mappaColori[temp] || '#FFFFFF';
    
    $('#step2b-temperatura-options').append(`
      <div class="col-md-4 mb-3">
        <div class="card option-card temperatura-card" data-temperatura="${temp}">
          <div class="card-body text-center">
            <h5 class="card-title">${nomeVisualizzato}</h5>
            <div class="temperatura-color-preview" style="background: ${colore};"></div>
          </div>
        </div>
      </div>
    `);
  });

  if (temperature.length === 1) {
    setTimeout(() => {
      $('.temperatura-card').addClass('selected');
      configurazione.temperaturaSelezionata = temperature[0];
      configurazione.temperaturaColoreSelezionata = temperature[0];
      checkStep2bParametriCompletion();
    }, 100);
  }
  
  $('.temperatura-card').on('click', function() {
    $('.temperatura-card').removeClass('selected');
    $(this).addClass('selected');
    configurazione.temperaturaSelezionata = $(this).data('temperatura');
    configurazione.temperaturaColoreSelezionata = configurazione.temperaturaSelezionata;
    
    checkStep2bParametriCompletion();
  });
}

function caricaOpzioniPotenzaStep2b() {
  $('#step2b-potenza-options').html('<div class="text-center"><div class="spinner-border"></div></div>');

  $.ajax({
    url: '/get_opzioni_potenza_standalone',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      tipologia: configurazione.tipologiaStripSelezionata,
      tensione: configurazione.tensioneSelezionato,
      ip: configurazione.ipSelezionato,
      temperatura: configurazione.temperaturaColoreSelezionata,
      special: configurazione.specialStripSelezionata
    }),
    success: function(data) {
      if (data.success) {
        renderOpzioniPotenza(data.potenze);
      }
    }
  });
}

function renderOpzioniPotenza(potenze) {
  $('#step2b-potenza-options').empty();

  const potenzeOrdinate = [...potenze].sort((a, b) => {
    const potenzaA = (a.id || a.nome || a).toString();
    const potenzaB = (b.id || b.nome || b).toString();
    
    const numA = parseInt(potenzaA.match(/\d+/)[0]);
    const numB = parseInt(potenzaB.match(/\d+/)[0]);
    
    return numA - numB;
  });
  
  potenzeOrdinate.forEach(function(potenza) {
    const potenzaId = potenza.id || potenza;
    const potenzaNome = potenza.nome || potenza;
    
    $('#step2b-potenza-options').append(`
      <div class="col-md-4 mb-3">
        <div class="card option-card potenza-card" data-potenza="${potenzaId}">
          <div class="card-body text-center">
            <h5 class="card-title">${potenzaNome}</h5>
          </div>
        </div>
      </div>
    `);
  });

  if (potenzeOrdinate.length === 1) {
    setTimeout(() => {
      $('.potenza-card').addClass('selected');
      const potenzaId = potenzeOrdinate[0].id || potenzeOrdinate[0];
      configurazione.potenzaSelezionata = potenzaId;
      caricaStripLedPerSoloStrip();
    }, 100);
  }
}

function checkStep2bParametriCompletion() {
  const isComplete = configurazione.tensioneSelezionato && 
                    configurazione.ipSelezionato && 
                    configurazione.temperaturaSelezionata;             
  $('#btn-continua-parametri-step2b').prop('disabled', !isComplete);
  return isComplete;
}

function checkStep2bPotenzaCompletion() {
  const isComplete = configurazione.potenzaSelezionata && 
                    configurazione.lunghezzaRichiestaMetri && 
                    configurazione.stripLedSceltaFinale;
 
  $('#btn-continua-potenza-step2b').prop('disabled', !isComplete);
  return isComplete;
}

function caricaStripLedPerSoloStrip() {
  
  if (!configurazione.potenzaSelezionata) {
    console.warn('⚠️ Potenza non selezionata, salto caricamento strip');
    return;
  }

  $('#step2b-strip-selection').show();
  $('#step2b-strip-led-container').html('<div class="text-center"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento modelli strip LED...</p></div>');

  configurazione.stripLedSceltaFinale = null;
  
  const requestData = {
    tipologia: configurazione.tipologiaStripSelezionata,
    special: configurazione.specialStripSelezionata,
    tensione: configurazione.tensioneSelezionato,
    ip: configurazione.ipSelezionato,
    temperatura: configurazione.temperaturaSelezionata,
    potenza: configurazione.potenzaSelezionata
  };
  
  $.ajax({
    url: '/get_strip_led_filtrate_standalone',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(requestData),
    success: function(data) {
      
      if (data.success && data.strip_led && data.strip_led.length > 0) {
        let stripHtml = '<div class="row">';
        
        data.strip_led.forEach(function(strip) {
          const nomeVisualizzato = strip.nomeCommerciale || strip.nome;
          const imgPath = `/static/img/strip/${strip.id}.jpg`;
          const hasStripDescription = strip.descrizione && strip.descrizione.trim() !== '';

          stripHtml += `
            <div class="col-md-4 mb-3">
              <div class="card option-card step2b-strip-led-card"
                  data-strip-id="${strip.id}"
                  data-nome-commerciale="${strip.nomeCommerciale || ''}"
                  data-lunghezza-massima="${strip.lunghezzaMassima || 5000}"
                  data-giuntabile="${strip.giuntabile !== undefined ? strip.giuntabile : true}">
                <img src="${imgPath}" class="card-img-top" alt="${nomeVisualizzato}"
                    style="height: 180px; object-fit: cover;"
                    onerror="this.src='/static/img/placeholder_logo.jpg'; this.style.height='180px';">
                <div class="card-body">
                  <h5 class="card-title">${nomeVisualizzato}</h5>
                  ${hasStripDescription ? `<p class="card-text text-muted small mb-1">${strip.descrizione}</p>` : ''}
                  <p class="card-text small mb-1">
                    Tensione: ${strip.tensione}, IP: ${strip.ip}, Temperatura: ${strip.temperatura}
                  </p>
                  <p class="card-text small mb-0">Potenza: ${configurazione.potenzaSelezionata}</p>
                </div>
              </div>
            </div>
          `;
        });
        
        stripHtml += '</div>';
        $('#step2b-strip-led-container').html(stripHtml);

        if (data.strip_led.length === 1) {
          setTimeout(() => {
            $('.step2b-strip-led-card').first().click();
          }, 100);
        }
      } else {
        console.error("❌ Nessuna strip trovata:", data);
        $('#step2b-strip-led-container').html(
          '<div class="alert alert-warning">Nessuna strip LED trovata per questa configurazione. Controlla i parametri selezionati.</div>'
        );
      }
    },
    error: function(xhr, status, error) {
      console.error("❌ Errore AJAX:", {
        status: xhr.status,
        statusText: xhr.statusText,
        responseText: xhr.responseText,
        error: error
      });
      
      $('#step2b-strip-led-container').html(
        '<div class="alert alert-danger">Errore nel caricamento delle strip LED. Riprova più tardi.</div>'
      );
    }
  });
}

function selezionaStripCompatibile() {
  $.ajax({
    url: '/get_strip_compatibile_standalone',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      tipologia: configurazione.tipologiaStripSelezionata,
      tensione: configurazione.tensioneSelezionato,
      ip: configurazione.ipSelezionato,
      temperatura: configurazione.temperaturaSelezionata,
      potenza: configurazione.potenzaSelezionata,
      special: configurazione.specialStripSelezionata
    }),
    success: function(data) {
      if (data.success && data.strip_led) {
        configurazione.stripLedSelezionata = data.strip_led.id;
        configurazione.nomeCommercialeStripLed = data.strip_led.nomeCommerciale;
        configurazione.temperaturaColoreSelezionata = configurazione.temperaturaSelezionata;
      }
    },
    error: function(error) {
      console.error("Errore nella selezione della strip compatibile:", error);
    }
  });
}