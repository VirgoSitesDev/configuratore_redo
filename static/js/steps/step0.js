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

function initStep2bTipologiaListeners() {
  $('.step2b-tipologia-card').on('click', function() {
    $('.step2b-tipologia-card').removeClass('selected');
    $(this).addClass('selected');
    
    configurazione.tipologiaStripSelezionata = $(this).data('tipologia');
    
    if (configurazione.tipologiaStripSelezionata === 'SPECIAL') {
      $('#step2b-special-container').show();
      configurazione.specialStripSelezionata = null;
      $('#btn-continua-tipologia-step2b').prop('disabled', true);
    } else {
      $('#step2b-special-container').hide();
      configurazione.specialStripSelezionata = null;
      $('#btn-continua-tipologia-step2b').prop('disabled', false);
    }
  });

  $('.step2b-special-card').on('click', function() {
    $('.step2b-special-card').removeClass('selected');
    $(this).addClass('selected');
    
    configurazione.specialStripSelezionata = $(this).data('special');
    $('#btn-continua-tipologia-step2b').prop('disabled', false);
  });

  $('#btn-torna-step0-da-tipologia').on('click', function(e) {
    e.preventDefault();
    $("#step2b-tipologia-strip").fadeOut(300, function() {
      $("#step0-scelta-modalita").fadeIn(300);
      updateProgressBar(0);
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

  $('#step2b-lunghezza-strip').on('input', function() {
    configurazione.lunghezzaRichiestaMetri = parseFloat($(this).val()) || null;
    if (configurazione.lunghezzaRichiestaMetri) {
      configurazione.lunghezzaRichiesta = configurazione.lunghezzaRichiestaMetri * 1000;
    }
    checkStep2bPotenzaCompletion();
  });

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
        console.error('Errore nella risposta tensioni:', data);
        $('#step2b-tensione-options').html('<p class="text-danger">Errore nel caricamento delle opzioni.</p>');
      }
    },
    error: function(xhr, status, error) {
      console.error('Errore AJAX tensioni:', xhr.responseText);
      $('#step2b-tensione-options').html('<p class="text-danger">Errore nel caricamento delle opzioni.</p>');
    }
  });
}

function renderOpzioniTensione(tensioni) {
  $('#step2b-tensione-options').empty();
  
  const mappaTensione = {
    '24V': '24V DC',
    '48V': '48V DC', 
    '220V': '220V AC'
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
      categoria: 'solo_strip'  // Identifica che è flusso solo strip
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
  
  potenze.forEach(function(potenza) {
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

  if (potenze.length === 1) {
    setTimeout(() => {
      $('.potenza-card').addClass('selected');
      const potenzaId = potenze[0].id || potenze[0];
      configurazione.potenzaSelezionata = potenzaId;
      checkStep2bPotenzaCompletion();
    }, 100);
  }
  
  $('.potenza-card').on('click', function() {
    $('.potenza-card').removeClass('selected');
    $(this).addClass('selected');
    configurazione.potenzaSelezionata = $(this).data('potenza');
    
    checkStep2bPotenzaCompletion();
  });
}

function checkStep2bParametriCompletion() {
  const isComplete = configurazione.tensioneSelezionato && 
                    configurazione.ipSelezionato && 
                    configurazione.temperaturaSelezionata;             
  $('#btn-continua-parametri-step2b').prop('disabled', !isComplete);
  return isComplete;
}

function checkStep2bPotenzaCompletion() {
  const isComplete = configurazione.potenzaSelezionata && configurazione.lunghezzaRichiestaMetri;
  $('#btn-continua-potenza-step2b').prop('disabled', !isComplete);

  if (isComplete) {
    selezionaStripCompatibile();
  }
  
  return isComplete;
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