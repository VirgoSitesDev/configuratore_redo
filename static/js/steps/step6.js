import { configurazione, mappaTipologieVisualizzazione, mappaStripLedVisualizzazione } from '../config.js';
import { updateProgressBar } from '../utils.js';
import { finalizzaConfigurazione } from '../api.js';

export function initStep6Listeners() {
  $('#btn-torna-step5-from-proposte').on('click', function(e) {
    e.preventDefault();
    
    $("#step6-proposte").fadeOut(300, function() {
      $("#step5-controllo").fadeIn(300);
      updateProgressBar(5);
    });
  });

  $('#btn-continua-step6').on('click', function(e) {
    e.preventDefault();
    finalizzaConfigurazione();
  });

  $(document).on('click', '.btn-seleziona-proposta', function() {
    $('.btn-seleziona-proposta').removeClass('active');
    $(this).addClass('active');
    
    const proposta = $(this).data('proposta');
    const valore = parseInt($(this).data('valore'), 10);

    configurazione.lunghezzaRichiesta = valore;
    $('#step6-lunghezza-finale').text(valore);
    $('#spazio-buio-warning').remove();

    if (proposta === 'originale') {
      const proposta1 = configurazione.proposta1;
      const spazioBuio = valore - proposta1;
      
      if (spazioBuio > 0) {
        $('.alert.alert-success.mt-4').append(`
          <p id="spazio-buio-warning" class="text-danger mb-0 mt-2" style="font-size: 1rem; color:#ff0000 !important">
            <strong>ATTENZIONE:</strong> Questa combinazione avrà uno spazio buio totale di ${spazioBuio}mm
          </p>
        `);
      }
    }
    
    $('#btn-continua-step6').prop('disabled', false);
  });

  $(document).on('click', '.btn-seleziona-combinazione', function() {
    
    $('.btn-seleziona-combinazione').removeClass('active');
    $(this).addClass('active');
    
    const combinazioneData = $(this).data('combinazione');
    
    let combinazione;
    if (typeof combinazioneData === 'string') {
      combinazione = JSON.parse(combinazioneData);
    } else {
      combinazione = combinazioneData;
    }

    configurazione.lunghezzeMultiple = Object.assign({}, combinazione.lunghezze);
    configurazione.lunghezzaRichiesta = combinazione.lunghezza_totale;

    $('#step6-lunghezza-finale').text(combinazione.lunghezza_totale);
  
    $('#spazio-buio-warning').remove();
    if (combinazione.ha_spazio_buio) {
      let spazioTotale = combinazione.spazio_buio_totale || 0;
      if (configurazione.formaDiTaglioSelezionata == "RETTANGOLO_QUADRATO") spazioTotale *= 2;
      $('.alert.alert-success.mt-4').append(`
        <p id="spazio-buio-warning" class="text-danger mb-0 mt-2" style="font-size: 1rem; color:#ff0000 !important">
          <strong>ATTENZIONE:</strong> Questa combinazione avrà uno spazio buio totale di ${spazioTotale}mm distribuito sui vari lati
        </p>
      `);
    }
    
    $('#btn-continua-step6').prop('disabled', false);
  });
}

function calcolaProposte(lunghezzaRichiesta) {
  return new Promise((resolve, reject) => {
    const requestData = {
      lunghezzaRichiesta: lunghezzaRichiesta,
      stripLedSelezionata: configurazione.stripLedSelezionata || configurazione.stripLedSceltaFinale,
      potenzaSelezionata: configurazione.potenzaSelezionata,
      formaDiTaglioSelezionata: configurazione.formaDiTaglioSelezionata
    };

    if (configurazione.formaDiTaglioSelezionata !== 'DRITTO_SEMPLICE' && configurazione.lunghezzeMultiple) {
      requestData.lunghezzeMultiple = configurazione.lunghezzeMultiple;
    }

    $.ajax({
      url: '/calcola_lunghezze',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(requestData),
      success: function(data) {
        if (!data.success) {
          reject("Errore nel calcolo delle proposte");
          return;
        }
        
        configurazione.spazioProduzione = data.spazioProduzione || 5;
        
        if (data.tipo === 'semplice') {
          configurazione.proposta1 = Math.floor(data.proposte.proposta1);
          configurazione.proposta2 = Math.floor(data.proposte.proposta2);
        } else {
          if (data.proposte_per_lato) {
            Object.keys(data.proposte_per_lato).forEach(lato => {
              if (Array.isArray(data.proposte_per_lato[lato])) {
                data.proposte_per_lato[lato] = data.proposte_per_lato[lato].map(val => Math.floor(val));
              }
            });
          }
          configurazione.propostePerLato = data.proposte_per_lato;
          configurazione.combinazioni = data.combinazioni;
        }
        
        data.formaDiTaglioSelezionata = requestData.formaDiTaglioSelezionata;
        resolve(data);
      },
      error: function(error) {
        console.error("Errore nel calcolo delle proposte:", error);
        reject(error);
      }
    });
  });
}

export function vaiAlleProposte() {
  $('#profilo-nome-step6').text(configurazione.nomeModello);
  $('#tipologia-nome-step6').text(mappaTipologieVisualizzazione[configurazione.tipologiaSelezionata] || configurazione.tipologiaSelezionata);
  
  if (configurazione.stripLedSelezionata !== 'senza_strip' && configurazione.stripLedSelezionata !== 'NO_STRIP') {
    const nomeStripLed = configurazione.nomeCommercialeStripLed || 
                         mappaStripLedVisualizzazione[configurazione.stripLedSelezionata] || 
                         configurazione.stripLedSelezionata;
    
    $('#strip-nome-step6').text(nomeStripLed);
  } else {
    $('#strip-nome-step6').text('Senza Strip LED');
  }

  const lunghezzaOriginale = configurazione.lunghezzaRichiesta || 0;
  $('#lunghezza-attuale').text(lunghezzaOriginale);
  $('#step6-lunghezza-finale').text(lunghezzaOriginale);
  $('#spazio-buio-warning').remove();

  if (configurazione.tipologiaSelezionata === 'profilo_intero') {
    $('#step6-proposte-container').html(`
      <div class="alert alert-info">
        <h5>Profilo intero con lunghezza standard</h5>
        <p>Hai selezionato un profilo intero con una lunghezza standard di ${configurazione.lunghezzaSelezionata ? configurazione.lunghezzaSelezionata : configurazione.lunghezzaRichiesta}mm.</p>
        <p>Non sono necessarie proposte di lunghezza per i profili interi.</p>
      </div>
    `);

    $('#step6-lunghezza-finale').text(lunghezzaOriginale);
    $('#btn-continua-step6').prop('disabled', false);
  } 
  else if (lunghezzaOriginale && lunghezzaOriginale > 0) {
    $('#step6-proposte-container').html(`
      <div class="text-center mt-3 mb-3">
        <div class="spinner-border" role="status"></div>
        <p class="mt-3">Calcolo proposte di lunghezza...</p>
      </div>
    `);

    calcolaProposte(lunghezzaOriginale)
      .then(data => {
        if (data.tipo === 'semplice') {
          renderProposteSemplici(data, lunghezzaOriginale);
        } else {
          renderProposteCombinazioni(data);
        }
      })
      .catch(error => {
        console.error("Errore nel calcolo delle proposte:", error);
        $('#step6-proposte-container').html(`
          <div class="alert alert-danger">
            <p>Non è stato possibile calcolare le proposte di lunghezza. Verrà utilizzata la lunghezza originale.</p>
          </div>
        `);
        $('#btn-continua-step6').prop('disabled', false);
      });
  } else {
    $('#step6-proposte-container').html(`
      <div class="alert alert-warning">
        <p>Non è stata impostata una lunghezza valida nello step di personalizzazione.</p>
        <p>Per procedere, torna indietro e imposta una lunghezza valida.</p>
      </div>
    `);
    $('#btn-continua-step6').prop('disabled', true);
  }
  updateProgressBar(6);

  $(".step-section").hide();
  $("#step6-proposte").fadeIn(300);
}

function renderProposteSemplici(data, lunghezzaOriginale) {
  data.proposte.proposta1 = Math.floor(data.proposte.proposta1);
  data.proposte.proposta2 = Math.floor(data.proposte.proposta2);
  lunghezzaOriginale = Math.floor(lunghezzaOriginale);
  
  const coincideConProposta1 = lunghezzaOriginale === data.proposte.proposta1;
  const coincideConProposta2 = lunghezzaOriginale === data.proposte.proposta2;
  const coincideConProposte = coincideConProposta1 || coincideConProposta2;
  let spazioBuio = data.proposte.proposta1 >= data.proposte.proposta2 ? Math.abs(lunghezzaOriginale - data.proposte.proposta1) + 5 : Math.abs(lunghezzaOriginale - data.proposte.proposta2) + 5;
  if (data.formaDiTaglioSelezionata == null) spazioBuio -= 5;
  const proposte = [];

  proposte.push({
    id: 'proposta1',
    titolo: 'Combinazione 1',
    valore: data.proposte.proposta1,
    badge: { classe: 'bg-success', testo: 'Ottimale' },
    hasSpaziBuio: false,
    spaziBuioTotale: 0
  });

  proposte.push({
    id: 'proposta2', 
    titolo: 'Combinazione 2',
    valore: data.proposte.proposta2,
    badge: { classe: 'bg-success', testo: 'Ottimale' },
    hasSpaziBuio: false,
    spaziBuioTotale: 0
  });

  if (!coincideConProposte && spazioBuio > 0) {
    proposte.push({
      id: 'originale',
      titolo: 'Combinazione 3',
      valore: lunghezzaOriginale,
      badge: { classe: 'bg-warning text-white', testo: `${spazioBuio}mm spazio buio` },
      hasSpaziBuio: true,
      spaziBuioTotale: spazioBuio
    });
  } else if (!coincideConProposte) {
    proposte.push({
      id: 'originale',
      titolo: 'Combinazione 3', 
      valore: lunghezzaOriginale,
      badge: { classe: 'bg-success', testo: 'Ottimale' },
      hasSpaziBuio: false,
      spaziBuioTotale: 0
    });
  }

  let proposteHTML = `
    <h5>Proposte di lunghezza standard</h5>
    <p>Il sistema ha calcolato delle proposte di lunghezza standard più adatte per la tua installazione.</p>
    <div class="row mt-3">
  `;

  proposte.forEach((proposta, index) => {
    proposteHTML += `
      <div class="col-md-6 col-lg-4 mb-3">
        <div class="card">
          <div class="card-body text-center">
            <h6 class="card-title">
              ${proposta.titolo}
              <span class="badge ${proposta.badge.classe} ms-2">${proposta.badge.testo}</span>
            </h6>
            <div class="small text-start mb-2">
              <div>Lunghezza: ${proposta.valore}mm</div>
            </div>
            <p class="card-text small"><strong>Totale: ${proposta.valore}mm</strong></p>
            <button class="btn ${proposta.hasSpaziBuio ? 'btn-outline-primary' : 'btn-outline-primary'} btn-seleziona-proposta" 
                    data-proposta="${proposta.id}" 
                    data-valore="${proposta.valore}">
              Seleziona
            </button>
          </div>
        </div>
      </div>
    `;
  });

  proposteHTML += `</div>`;
  
  $('#step6-proposte-container').html(proposteHTML);

  if (spazioBuio > 0) {
    let warningElement = $(`<p id="spazio-buio-warning" class="text-danger mb-0 mt-2" style="display: none; font-size: 1rem; color:#e83f34 !important">
      <strong>ATTENZIONE:</strong> se si sceglie questa misura si verificherà uno spazio buio nel profilo di ${spazioBuio}mm
    </p>`);

    $('.alert.alert-success.mt-4').append(warningElement);
  }

  if (coincideConProposta1) {
    setTimeout(() => {
      $('.btn-seleziona-proposta[data-proposta="proposta1"]').addClass('active');
      configurazione.lunghezzaRichiesta = data.proposte.proposta1;
      $('#step6-lunghezza-finale').text(data.proposte.proposta1);
      $('#btn-continua-step6').prop('disabled', false);
    }, 100);
  } else if (coincideConProposta2) {
    setTimeout(() => {
      $('.btn-seleziona-proposta[data-proposta="proposta2"]').addClass('active');
      configurazione.lunghezzaRichiesta = data.proposte.proposta2;
      $('#step6-lunghezza-finale').text(data.proposte.proposta2);
      $('#btn-continua-step6').prop('disabled', false);
    }, 100);
  }
}

function renderProposteCombinazioni(data) {
  data.combinazioni.forEach(combinazione => {
    combinazione.lunghezza_totale = Math.floor(combinazione.lunghezza_totale);

    Object.keys(combinazione.lunghezze).forEach(lato => {
      combinazione.lunghezze[lato] = Math.floor(combinazione.lunghezze[lato]);
    });

    if (combinazione.spazio_buio_totale) {
      combinazione.spazio_buio_totale = Math.floor(combinazione.spazio_buio_totale);
    }
  });

  const lunghezzeMultipleArrotondate = {};
  Object.keys(configurazione.lunghezzeMultiple).forEach(lato => {
    lunghezzeMultipleArrotondate[lato] = Math.floor(configurazione.lunghezzeMultiple[lato]);
  });
  
  const etichetteLati = {
    'FORMA_L_DX': {
      'lato1': 'Lato orizzontale',
      'lato2': 'Lato verticale'
    },
    'FORMA_L_SX': {
      'lato1': 'Lato orizzontale',
      'lato2': 'Lato verticale'
    },
    'FORMA_C': {
      'lato1': 'Lato orizzontale superiore',
      'lato2': 'Lato verticale',
      'lato3': 'Lato orizzontale inferiore'
    },
    'RETTANGOLO_QUADRATO': {
      'lato1': 'Lunghezza',
      'lato2': 'Larghezza'
    }
  };

  const etichette = etichetteLati[configurazione.formaDiTaglioSelezionata] || {};
  
  let proposteHTML = `
    <h5>Proposte di combinazioni per forma complessa</h5>
    <p>Il sistema ha calcolato diverse combinazioni ottimali per i tuoi lati. Seleziona la combinazione che preferisci:</p>
  `;

  proposteHTML += `
    <div class="alert alert-info mb-4">
      <h6>Misure originali inserite:</h6>
      <ul class="mb-3">
  `;
  
  Object.entries(configurazione.lunghezzeMultiple).forEach(([lato, valore]) => {
    if (valore) {
      const etichetta = etichette[lato] || `Lato ${lato.replace('lato', '')}`;
      proposteHTML += `<li>${etichetta}: ${valore}mm</li>`;
    }
  });
  
  proposteHTML += `
      </ul>
    </div>
    <div class="row mt-3">
  `;

  data.combinazioni.forEach((combinazione, index) => {
    let cardClass = 'btn-outline-primary';
    let badgeClass = 'bg-success';
    let badgeText = 'Ottimale';
    
    if (combinazione.ha_spazio_buio) {
      cardClass = 'btn-outline-primary';
      badgeClass = 'bg-warning text-white';
      let latiCambiati = 0;
      Object.keys(combinazione.lunghezze).forEach(lato => {
        const lunghezzaCombinazione = combinazione.lunghezze[lato];
        const lunghezzaOriginale = configurazione.lunghezzeMultiple[lato];
        
        if (lunghezzaCombinazione === lunghezzaOriginale) {
          latiCambiati++;
        }
      });
      let spazioTotale = combinazione.spazio_buio_totale + (5 * latiCambiati) || 0;
      if (configurazione.formaDiTaglioSelezionata == "RETTANGOLO_QUADRATO") spazioTotale *= 2;
      badgeText = `${spazioTotale}mm spazio buio`;
    }

    const combinazioneJson = JSON.stringify(combinazione).replace(/"/g, '&quot;');
    
    proposteHTML += `
      <div class="col-md-6 col-lg-4 mb-3">
        <div class="card">
          <div class="card-body text-center">
            <h6 class="card-title">
              Combinazione ${index + 1}
              <span class="badge ${badgeClass} ms-2">${badgeText}</span>
            </h6>
            <div class="small text-start mb-2">
    `;
    
    Object.entries(combinazione.lunghezze).forEach(([lato, valore]) => {
      const etichetta = etichette[lato] || `Lato ${lato.replace('lato', '')}`;
      const originale = configurazione.lunghezzeMultiple[lato];
      const isModificato = valore !== originale;

      proposteHTML += `
        <div>${etichetta}: ${valore}mm</div>
      `;
    });
    
    proposteHTML += `
            </div>
            <p class="card-text small"><strong>Totale: ${combinazione.lunghezza_totale}mm</strong></p>
            <button class="btn ${cardClass} btn-seleziona-combinazione" 
                    data-combinazione="${combinazioneJson}">
              Seleziona
            </button>
          </div>
        </div>
      </div>
    `;
  });

  proposteHTML += `</div>`;
  
  $('#step6-proposte-container').html(proposteHTML);
}