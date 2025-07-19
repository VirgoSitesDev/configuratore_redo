import { configurazione, mappaTipologieVisualizzazione, mappaTensioneVisualizzazione, mappaIPVisualizzazione, mappaStripLedVisualizzazione, mappaFormeTaglio, mappaFiniture, mappaCategorieVisualizzazione, mappaTipologiaStripVisualizzazione, mappaSpecialStripVisualizzazione } from './config.js';
import { formatTemperatura, getTemperaturaColor, checkParametriCompletion, checkStep2Completion, updateProgressBar, checkPersonalizzazioneCompletion } from './utils.js';
import { initRiepilogoOperationsListeners } from './steps/step7.js';
import { calcolaCodiceProdottoCompleto } from './codici_prodotto.js';

export function caricaProfili(categoria) {
  
  $('#profili-container').empty().html('<div class="text-center mt-5"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento profili...</p></div>');
  
  $.ajax({
    url: `/get_profili/${categoria}`,
    method: 'GET',
    success: function(data) {
      
      $('#profili-container').empty();
      
      if (!data || data.length === 0) {
        $('#profili-container').html('<div class="col-12 text-center"><p>Nessun profilo disponibile per questa categoria.</p></div>');
        return;
      }
      
      let grid = $('<div class="row"></div>');
      $('#profili-container').append(grid);
      
      data.forEach(function(profilo) {
        let profiloCard = $(`
          <div class="col-md-4 col-sm-6 mb-4 profilo-card-row">
            <div class="card profilo-card" data-id="${profilo.id}" data-nome="${profilo.nome}">
              <img src="${profilo.immagine || '/static/img/placeholder_logo.jpg'}" class="card-img-top" alt="${profilo.nome}" onerror="this.src='/static/img/placeholder_logo.jpg'">
              <div class="card-body">
                <h5 class="card-title">${profilo.nome}</h5>
              </div>
            </div>
          </div>
        `);
        
        grid.append(profiloCard);
      });
      
      $('.profilo-card').on('click', function(e) {
        e.stopPropagation();
        $('.profilo-card').removeClass('selected');
        $(this).addClass('selected');
        configurazione.profiloSelezionato = $(this).data('id');
        configurazione.nomeModello = $(this).data('nome');
        configurazione.lunghezzaRichiesta = null;
        configurazione.lunghezzaSelezionata = null;
        configurazione.lunghezzaProfiloIntero = null;
        configurazione.lunghezzaMassimaProfilo = null;
        configurazione.lunghezzeDisponibili = [];
        configurazione.lunghezzaStandard = null;
        
        caricaOpzioniProfilo(configurazione.profiloSelezionato);
      });
      $('[data-bs-toggle="tooltip"]').tooltip();
    },
    error: function(error) {
      console.error("Errore nel caricamento dei profili:", error);
      $('#profili-container').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento dei profili. Riprova più tardi.</p></div>');
    }
  });
}

export function caricaOpzioniProfilo(profiloId) {
  
  $('#tipologie-options').empty().html('<div class="text-center mt-3"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento opzioni...</p></div>');
  $('#btn-continua-step2').prop('disabled', true);
  
  configurazione.tipologiaSelezionata = null;
  configurazione.stripLedSelezionata = null;
  $('#lunghezza-profilo-container').hide();

  $.ajax({
    url: `/get_profili/${configurazione.categoriaSelezionata}`,
    method: 'GET',
    success: function(profili) {
      const profiloSelezionato = profili.find(p => p.id === profiloId);

      if (profiloSelezionato) {
        configurazione.lunghezzaMassimaProfilo = profiloSelezionato.lunghezzaMassima || 3000;
        configurazione.lunghezzaStandard = profiloSelezionato.lunghezzaStandard || configurazione.lunghezzaMassimaProfilo;
        configurazione.lunghezzeDisponibili = profiloSelezionato.lunghezzeDisponibili || [configurazione.lunghezzaStandard];
      }

      $.ajax({
        url: `/get_opzioni_profilo/${profiloId}`,
        method: 'GET',
        success: function(data) {
          
          $('#tipologie-options').empty();
          
          $('#tipologia-container').show();
          
          if (!data.tipologie || data.tipologie.length === 0) {
            $('#tipologie-options').html('<div class="col-12 text-center"><p>Nessuna tipologia disponibile per questo profilo.</p></div>');
          } else {
            data.tipologie.forEach(function(tipologia) {
              let lunghezzaInfo = '';
              if (tipologia === 'profilo_intero') {
                const lunghezze = configurazione.lunghezzeDisponibili || [];
                if (lunghezze.length === 1) {
                  const lunghezzaMetri = lunghezze[0] / 1000;
                  lunghezzaInfo = ` (${lunghezzaMetri}m)`;
                } else if (lunghezze.length > 1) {
                  const lunghezzeText = lunghezze.map(l => `${l / 1000}m`).join(', ');
                  lunghezzaInfo = ` (${lunghezzeText})`;
                }
              }
              
              $('#tipologie-options').append(`
                <div class="col-md-6 mb-3">
                  <div class="card option-card tipologia-card" data-id="${tipologia}">
                    <div class="card-body text-center">
                      <h5 class="card-title">${mappaTipologieVisualizzazione[tipologia] || tipologia} ${configurazione.lunghezzeDisponibili.length < 2 && mappaTipologieVisualizzazione[tipologia] == 'Profilo intero' ? '(' + configurazione.lunghezzaStandard + 'mm)' : ''}</h5>
                    </div>
                  </div>
                </div>
              `);
            });
          }

          $('.tipologia-card').on('click', function() {
            $('.tipologia-card').removeClass('selected');
            $(this).addClass('selected');
            configurazione.tipologiaSelezionata = $(this).data('id');
            configurazione.lunghezzaRichiesta = null;

            if (configurazione.tipologiaSelezionata === 'profilo_intero') {
              if (configurazione.lunghezzeDisponibili && configurazione.lunghezzeDisponibili.length > 1) {
                mostraOpzioniLunghezzaProfilo();
                $('#btn-continua-step2').prop('disabled', true);
              } else {
                $('#lunghezza-profilo-container').hide();
                if (configurazione.lunghezzeDisponibili && configurazione.lunghezzeDisponibili.length === 1) {
                  configurazione.lunghezzaRichiesta = configurazione.lunghezzeDisponibili[0];
                } else {
                  configurazione.lunghezzaRichiesta = configurazione.lunghezzaStandard || 3000;
                }
                configurazione.lunghezzaProfiloIntero = configurazione.lunghezzaRichiesta;
                checkStep2Completion();
              }
            } else {
              $('#lunghezza-profilo-container').hide();
              checkStep2Completion();
            }
          });
        },
        error: function(error) {
          console.error("Errore nel caricamento delle opzioni:", error);
          $('#tipologie-options').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento delle opzioni. Riprova più tardi.</p></div>');
        }
      });
    },
    error: function(error) {
      console.error("Errore nel caricamento dei dettagli del profilo:", error);
    }
  });
}

function mostraOpzioniLunghezzaProfilo() {
  $('#lunghezze-profilo-options').empty();
  
  if (!configurazione.lunghezzeDisponibili || configurazione.lunghezzeDisponibili.length === 0) {
    configurazione.lunghezzeDisponibili = [configurazione.lunghezzaStandard || 3000];
  }

  const lunghezzeOrdinate = [...configurazione.lunghezzeDisponibili].sort((a, b) => a - b);
  
  lunghezzeOrdinate.forEach(function(lunghezza) {
    const lunghezzaMetri = lunghezza / 1000;
    $('#lunghezze-profilo-options').append(`
      <div class="col-md-3 mb-3">
        <div class="card option-card lunghezza-profilo-card" data-lunghezza="${lunghezza}">
          <div class="card-body text-center">
            <h5 class="card-title">${lunghezza}mm</h5>
            <p class="small text-muted">${lunghezzaMetri}m</p>
          </div>
        </div>
      </div>
    `);
  });
  $('#lunghezza-profilo-container').show();
  $('.lunghezza-profilo-card').on('click', function() {
    $('.lunghezza-profilo-card').removeClass('selected');
    $(this).addClass('selected');

    const lunghezzaSelezionata = parseInt($(this).data('lunghezza'), 10);
    configurazione.lunghezzaRichiesta = lunghezzaSelezionata;
    configurazione.lunghezzaProfiloIntero = lunghezzaSelezionata;
    configurazione.lunghezzaSelezionata = lunghezzaSelezionata;

    checkStep2Completion();
  });

  if (lunghezzeOrdinate.length === 1) {
    setTimeout(function() {
      const $unicaLunghezza = $('.lunghezza-profilo-card');
      $unicaLunghezza.addClass('selected');
      configurazione.lunghezzaRichiesta = lunghezzeOrdinate[0];
      configurazione.lunghezzaProfiloIntero = lunghezzeOrdinate[0];
      configurazione.lunghezzaSelezionata = lunghezzeOrdinate[0];
      checkStep2Completion();
    }, 100);
  }
}

export function caricaOpzioniParametri(profiloId, potenza = null) {
  
  $('#tensione-options').empty().html('<div class="spinner-border" role="status"></div><p>Caricamento opzioni tensione...</p>');
  $('#ip-options').empty();
  $('#temperatura-iniziale-options').empty();
  
  configurazione.tensioneSelezionato = null;
  configurazione.ipSelezionato = null;
  configurazione.temperaturaSelezionata = null;
  
  $('#btn-continua-parametri').prop('disabled', true);
  
  let url = `/get_opzioni_tensione/${profiloId}`;
  if (configurazione.tipologiaStripSelezionata) {
    url += `/${configurazione.tipologiaStripSelezionata}`;
  }

  $.ajax({
    url: url,
    method: 'GET',
    success: function(data) {
      
      $('#tensione-options').empty();
      
      if (!data.success) {
        $('#tensione-options').html('<p class="text-danger">Errore nel caricamento delle opzioni tensione.</p>');
        return;
      }
      
      if (!data.voltaggi || data.voltaggi.length === 0) {
        $('#tensione-options').html('<p>Nessuna opzione di tensione disponibile per questo profilo.</p>');
        return;
      }
      
      data.voltaggi.sort((a, b) => {
        const voltA = parseInt(a.replace('V', ''));
        const voltB = parseInt(b.replace('V', ''));
        return voltA - voltB;  
      });

      data.voltaggi.forEach(function(tensione) {
        $('#tensione-options').append(`
          <div class="col-md-4 mb-3">
            <div class="card option-card tensione-card" data-tensione="${tensione}">
              <div class="card-body text-center">
                <h5 class="card-title">${mappaTensioneVisualizzazione[tensione] || tensione}</h5>
              </div>
            </div>
          </div>
        `);
      });

      if (data.voltaggi.length === 1) {
        const $unicaTensione = $('.tensione-card');
        $unicaTensione.addClass('selected');
        configurazione.tensioneSelezionato = data.voltaggi[0];
        caricaOpzioniIP(profiloId, configurazione.tensioneSelezionato);
      }
      
      $('.tensione-card').on('click', function() {
        $('.tensione-card').removeClass('selected');
        $(this).addClass('selected');
        configurazione.tensioneSelezionato = $(this).data('tensione');
        
        caricaOpzioniIP(profiloId, configurazione.tensioneSelezionato);
        checkParametriCompletion();
      });
    },
    error: function(error) {
      console.error("Errore nel caricamento delle opzioni tensione:", error);
      $('#tensione-options').html('<p class="text-danger">Errore nel caricamento delle opzioni tensione. Riprova più tardi.</p>');
    }
  });
}

export function caricaOpzioniIP(profiloId, tensione) {
  
  $('#ip-options').empty().html('<div class="spinner-border" role="status"></div><p>Caricamento opzioni IP...</p>');
  $('#temperatura-iniziale-options').empty();
  
  configurazione.ipSelezionato = null;
  configurazione.temperaturaSelezionata = null;
  
  $.ajax({
    url: `/get_opzioni_ip/${profiloId}/${tensione}/${configurazione.tipologiaStripSelezionata}`,
    method: 'GET',
    success: function(data) {
      
      $('#ip-options').empty();
      
      if (!data.success) {
        $('#ip-options').html('<p class="text-danger">Errore nel caricamento delle opzioni IP.</p>');
        return;
      }
      if (!data.ip || data.ip.length === 0) {
        $('#ip-options').html('<p>Nessuna opzione IP disponibile per questa combinazione.</p>');
        return;
      }

      data.ip.sort((a, b) => {
        const ipNumA = parseInt(a.replace('IP', ''));
        const ipNumB = parseInt(b.replace('IP', ''));
        return ipNumA - ipNumB;
      });
      
      data.ip.forEach(function(ip) {
        $('#ip-options').append(`
          <div class="col-md-4 mb-3">
            <div class="card option-card ip-card" data-ip="${ip}">
              <div class="card-body text-center">
                <h5 class="card-title">${mappaIPVisualizzazione[ip] || ip}</h5>
              </div>
            </div>
          </div>
        `);
      });

      if (data.ip.length === 1) {
        const $unicoIP = $('.ip-card');
        $unicoIP.addClass('selected');
        configurazione.ipSelezionato = data.ip[0];
        caricaOpzioniTemperaturaIniziale(profiloId, tensione, configurazione.ipSelezionato);
      }
      
      $('.ip-card').on('click', function() {
        $('.ip-card').removeClass('selected');
        $(this).addClass('selected');
        configurazione.ipSelezionato = $(this).data('ip');
        
        caricaOpzioniTemperaturaIniziale(profiloId, configurazione.tensioneSelezionato, configurazione.ipSelezionato);
        checkParametriCompletion();
      });
    },
    error: function(error) {
      console.error("Errore nel caricamento delle opzioni IP:", error);
      $('#ip-options').html('<p class="text-danger">Errore nel caricamento delle opzioni IP. Riprova più tardi.</p>');
    }
  });
}

export function caricaOpzioniTemperaturaIniziale(profiloId, tensione, ip) {
  
  $('#temperatura-iniziale-options').empty().html('<div class="spinner-border" role="status"></div><p>Caricamento opzioni temperatura...</p>');
  configurazione.temperaturaSelezionata = null;
  
  $.ajax({
    url: `/get_opzioni_temperatura_iniziale/${profiloId}/${tensione}/${ip}/${configurazione.tipologiaStripSelezionata}`,
    method: 'GET',
    success: function(data) {
      
      $('#temperatura-iniziale-options').empty();
      
      if (!data.success) {
        $('#temperatura-iniziale-options').html('<p class="text-danger">Errore nel caricamento delle opzioni temperatura.</p>');
        return;
      }
      
      if (!data.temperature || data.temperature.length === 0) {
        $('#temperatura-iniziale-options').html('<p>Nessuna opzione di temperatura disponibile per questa combinazione.</p>');
        return;
      }

      data.temperature.sort((a, b) => {
        const getOrderValue = (temp) => {
          if (temp.includes('K')) {
            return parseInt(temp.replace('K', ''));
          } else if (temp === 'CCT') {
            return 10000;
          } else if (temp === 'RGB') {
            return 20000;
          } else if (temp === 'RGBW') {
            return 30000;
          }
          return 0;
        };
        
        return getOrderValue(a) - getOrderValue(b);
      });
      
      data.temperature.forEach(function(temperatura) {
        $('#temperatura-iniziale-options').append(`
          <div class="col-md-4 mb-3">
            <div class="card option-card temperatura-iniziale-card" data-temperatura="${temperatura}">
              <div class="card-body text-center">
                <h5 class="card-title">${formatTemperatura(temperatura)}</h5>
                <div class="temperatura-color-preview" style="background: ${getTemperaturaColor(temperatura)};"></div>
              </div>
            </div>
          </div>
        `);
      });

      if (data.temperature.length === 1) {
        const $unicaTemperatura = $('.temperatura-iniziale-card');
        $unicaTemperatura.addClass('selected');
        configurazione.temperaturaSelezionata = data.temperature[0];
        checkParametriCompletion();
      }
      
      $('.temperatura-iniziale-card').on('click', function() {
        $('.temperatura-iniziale-card').removeClass('selected');
        $(this).addClass('selected');
        configurazione.temperaturaSelezionata = $(this).data('temperatura');
        
        checkParametriCompletion();
      });
    },
    error: function(error) {
      console.error("Errore nel caricamento delle opzioni temperatura:", error);
      $('#temperatura-iniziale-options').html('<p class="text-danger">Errore nel caricamento delle opzioni temperatura. Riprova più tardi.</p>');
    }
  });
}

function filterStripsByType(strips) {
  return strips.filter(strip => {
    if (configurazione.tipologiaStripSelezionata === 'COB') {
      return strip.id.includes('COB');
    }
    else if (configurazione.tipologiaStripSelezionata === 'SMD') {
      return strip.id.includes('SMD');
    }
    else if (configurazione.tipologiaStripSelezionata === 'SPECIAL') {
      if (!configurazione.specialStripSelezionata) {
        const allSpecialKeywords = ['XMAGIS', 'ZIGZAG', 'XFLEX', 'XSNAKE', 'RUNNING'];
        return allSpecialKeywords.some(keyword => 
          (strip.nomeCommerciale && strip.nomeCommerciale.toUpperCase().includes(keyword)) ||
          (strip.id && strip.id.toUpperCase().includes(keyword))
        );
      }

      const specialStripMap = {
        'XFLEX': ['XFLEX'],
        'RUNNING': ['RUNNING'],
        'ZIG_ZAG': ['ZIG_ZAG'],
        'XSNAKE': ['XSNAKE'],
        'XMAGIS': ['XMAGIS']
      };
      
      const specialStripIds = specialStripMap[configurazione.specialStripSelezionata] || [];

      return specialStripIds.some(id => 
        (strip.nomeCommerciale && strip.nomeCommerciale.toUpperCase().includes(id)) ||
        (strip.id && strip.id.toUpperCase().includes(id))
      );
    }
    
    return true;
  });
}

export function caricaOpzioniPotenza(profiloId, temperatura) {
  $('#potenza-container').html('<div class="col-12 text-center"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento opzioni potenza...</p></div>');
  $('#strip-led-model-section').hide();
  $('#strip-led-compatibili-container').empty();

  configurazione.potenzaSelezionata = null;
  configurazione.stripLedSceltaFinale = null;

  $('#btn-continua-step3').prop('disabled', true);

  if (profiloId === 'ESTERNI' || configurazione.isFlussoProfiliEsterni) {
    $.ajax({
      url: `/get_strip_compatibili_esterni/${configurazione.categoriaSelezionata}`,
      method: 'GET',
      success: function(compatData) {
        if (compatData.success && compatData.strip_compatibili.length > 0) {
          const stripFiltrate = compatData.strip_details.filter(strip => {
            if (strip.tensione !== configurazione.tensioneSelezionato) return false;
            if (strip.ip !== configurazione.ipSelezionato) return false;

            if (configurazione.tipologiaStripSelezionata === 'SPECIAL' && configurazione.specialStripSelezionata) {
              const specialKeywords = {
                'XFLEX': ['XFLEX'],
                'XSNAKE': ['XSNAKE'],
                'XMAGIS': ['XMAGIS', 'MG13X12', 'MG12X17'],
                'ZIG_ZAG': ['ZIGZAG', 'ZIG_ZAG'],
                'RUNNING': ['RUNNING']
              };
              const keywords = specialKeywords[configurazione.specialStripSelezionata] || [];
              const hasKeyword = keywords.some(keyword => 
                (strip.nome_commerciale && strip.nome_commerciale.toUpperCase().includes(keyword)) ||
                (strip.id && strip.id.toUpperCase().includes(keyword))
              );
              if (!hasKeyword) return false;
            }
            
            return true;
          });
          
          if (stripFiltrate.length > 0) {
            caricaPotenzeDaStrip(stripFiltrate, temperatura);
          } else {
            $('#potenza-container').html('<div class="col-12 text-center"><p>Nessuna potenza disponibile per questa configurazione.</p></div>');
          }
        } else {
          $('#potenza-container').html('<div class="col-12 text-center"><p>Nessuna strip LED compatibile trovata per i profili esterni.</p></div>');
        }
      },
      error: function(error) {
        console.error("Errore nel caricamento delle strip compatibili:", error);
        caricaPotenzaStandard();
      }
    });
  } else {
    let url = `/get_opzioni_potenza/${profiloId}/${configurazione.tensioneSelezionato}/${configurazione.ipSelezionato}/${temperatura}/${configurazione.tipologiaStripSelezionata}`;
    
    $.ajax({
      url: url,
      method: 'GET',
      success: function(data) {
        $('#potenza-container').empty();
        
        if (!data.success) {
          $('#potenza-container').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento delle opzioni potenza.</p></div>');
          return;
        }
        
        if (!data.potenze || data.potenze.length === 0) {
          $('#potenza-container').html('<div class="col-12 text-center"><p>Nessuna opzione di potenza disponibile per questa combinazione.</p></div>');
          return;
        }

        renderizzaOpzioniPotenza(data.potenze);
      },
      error: function(xhr, status, error) {
        console.error("Errore AJAX potenza:", {
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText,
          error: error
        });
        $('#potenza-container').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento delle opzioni potenza. Riprova più tardi.</p></div>');
      }
    });
  }
}

function caricaPotenzeDaStrip(stripFiltrate, temperatura) {
  const stripIds = stripFiltrate.map(s => s.id);

  $.ajax({
    url: '/get_opzioni_potenza_standalone',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      tipologia: configurazione.tipologiaStripSelezionata,
      tensione: configurazione.tensioneSelezionato,
      ip: configurazione.ipSelezionato,
      temperatura: temperatura,
      special: configurazione.specialStripSelezionata,
      strip_ids: stripIds
    }),
    success: function(data) {
      $('#potenza-container').empty();
      
      if (data.success && data.potenze && data.potenze.length > 0) {
        renderizzaOpzioniPotenza(data.potenze);
      } else {
        $('#potenza-container').html('<div class="col-12 text-center"><p>Nessuna potenza disponibile per questa configurazione.</p></div>');
      }
    },
    error: function(error) {
      console.error("Errore nel caricamento delle potenze:", error);
      caricaPotenzaStandard();
    }
  });
}

function caricaPotenzaStandard() {
  $.ajax({
    url: '/get_opzioni_potenza_standalone',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      tipologia: configurazione.tipologiaStripSelezionata,
      tensione: configurazione.tensioneSelezionato,
      ip: configurazione.ipSelezionato,
      temperatura: configurazione.temperaturaSelezionata,
      special: configurazione.specialStripSelezionata
    }),
    success: function(data) {
      $('#potenza-container').empty();
      
      if (data.success && data.potenze) {
        renderizzaOpzioniPotenza(data.potenze);
      } else {
        $('#potenza-container').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento delle potenze.</p></div>');
      }
    }
  });
}

export function caricaStripLedCompatibili(profiloId, tensione, ip, temperatura, potenza, tipologia_strip) {

  if (configurazione.modalitaConfigurazione === 'solo_strip') {
    if (configurazione.stripLedSelezionata && configurazione.nomeCommercialeStripLed) {
      const stripHtml = `
        <div class="row">
          <div class="col-md-12 mb-3">
            <div class="card option-card strip-led-compatibile-card selected" 
                data-strip-id="${configurazione.stripLedSelezionata}" 
                data-nome-commerciale="${configurazione.nomeCommercialeStripLed}">
              <div class="card-body text-center">
                <h5 class="card-title">${configurazione.nomeCommercialeStripLed}</h5>
                <p class="card-text small">
                  Tensione: ${tensione}, IP: ${ip}, Temperatura: ${temperatura}
                </p>
                <p class="card-text small">Potenza: ${potenza}</p>
                <p class="card-text text-success">✓ Strip LED selezionata automaticamente</p>
              </div>
            </div>
          </div>
        </div>
      `;
      
      $('#strip-led-compatibili-container').html(stripHtml);

      configurazione.stripLedSceltaFinale = configurazione.stripLedSelezionata;
      $('#btn-continua-step3').prop('disabled', false);
    } else {
      $('#strip-led-compatibili-container').html(`
        <div class="col-12 text-center">
          <div class="alert alert-info">
            <p>Strip LED configurata automaticamente in base ai parametri selezionati.</p>
          </div>
        </div>
      `);
      $('#btn-continua-step3').prop('disabled', false);
    }
    return;
  }

  if (!profiloId || !tensione || !ip || !temperatura || !potenza) {
    console.error("Parametri mancanti per caricaStripLedCompatibili:", {
      profiloId, tensione, ip, temperatura, potenza
    });
    $('#strip-led-compatibili-container').html('<div class="col-12 text-center"><p class="text-danger">Errore: parametri mancanti. Verifica di aver selezionato tutti i valori necessari.</p></div>');
    return;
  }
  
  $('#strip-led-compatibili-container').empty().html('<div class="text-center"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento modelli di strip LED compatibili...</p></div>');
  
  configurazione.stripLedSceltaFinale = null;
  $('#btn-continua-step3').prop('disabled', true);
  var potenzaNew = potenza.replace(' ', '-');
  var potenzaFinale = potenzaNew.replace('/', '_');

  let url;
  if (profiloId === 'ESTERNI') {
    url = `/get_strip_led_filtrate/ESTERNI/${tensione}/${ip}/${temperatura}/${potenzaFinale}/${tipologia_strip}`;
  } else {
    url = `/get_strip_led_filtrate/${profiloId}/${tensione}/${ip}/${temperatura}/${potenzaFinale}/${tipologia_strip}`;
  }
  
  $.ajax({
    url: url,
    method: 'GET',
    success: function(data) {
      
      if (!data.success) {
        $('#strip-led-compatibili-container').html(`<div class="col-12 text-center"><p class="text-danger">Errore: ${data.message || 'Errore sconosciuto'}</p></div>`);
        return;
      }
      
      if (!data.strip_led || data.strip_led.length === 0) {
        $('#strip-led-compatibili-container').html('<div class="col-12 text-center"><p>Nessuna strip LED disponibile per questa combinazione di parametri.</p></div>');
        return;
      }
      
      let stripHtml = '<div class="row">';
      
      data.strip_led.forEach(function(strip, index) {
        const nomeVisualizzato = strip.nomeCommerciale || strip.nome;
        const imgPath = `/static/img/strip/${strip.id}.jpg`;
        const imgPath2 = `/static/img/strip/${strip.id}_2.jpg`;
        const ipAlreadyInName = nomeVisualizzato && 
                             (nomeVisualizzato.includes('IP65') || 
                              nomeVisualizzato.includes('IP66') || 
                              nomeVisualizzato.includes('IP67') || 
                              nomeVisualizzato.includes('IP20') ||
                              nomeVisualizzato.includes('IP44'));

        let ipInCommercialName = '';
        if (ipAlreadyInName) {
          const ipMatch = nomeVisualizzato.match(/IP(20|44|65|66|67)/);
          if (ipMatch && ipMatch[0]) {
            ipInCommercialName = ipMatch[0];
          }
        }

        let showTechnicalName = true;
        let technicalNameDisplay = strip.nome;

        if (ipAlreadyInName && ipInCommercialName && strip.nome.includes('IP')) {
          technicalNameDisplay = strip.nome.replace(/IP(20|44|65|66|67)/, ipInCommercialName);

          const commercialWords = nomeVisualizzato.replace(/\s+/g, ' ').toLowerCase().split(' ');
          const technicalWords = technicalNameDisplay.replace(/\s+/g, ' ').toLowerCase().split(' ');
          const commonWords = commercialWords.filter(word => technicalWords.includes(word));

          if (commonWords.length >= Math.min(commercialWords.length, technicalWords.length) * 0.5) {
            showTechnicalName = false;
          }
        }

        let infoText = '';
        if (ipAlreadyInName) {
          infoText = `Tensione: ${strip.tensione}, Temperatura: ${formatTemperatura ? formatTemperatura(strip.temperatura) : strip.temperatura}`;
        } else {
          infoText = `Tensione: ${strip.tensione}, IP: ${strip.ip}, Temperatura: ${formatTemperatura ? formatTemperatura(strip.temperatura) : strip.temperatura}`;
        }
        
        stripHtml += `
          <div class="col-md-4 mb-3">
            <div class="card option-card strip-led-compatibile-card" 
                data-strip-id="${strip.id}" 
                data-nome-commerciale="${strip.nomeCommerciale || ''}">
              <img src="${imgPath}" class="card-img-top" alt="${nomeVisualizzato}" 
                  style="height: 180px; object-fit: cover;" 
                  onerror="this.src='/static/img/placeholder_logo.jpg'; this.style.height='180px';">
              <img src="${imgPath2}" class="card-img-strip-detail" alt="Dettaglio ${nomeVisualizzato}" 
                  style="height: 60px; width: 100%; object-fit: cover; margin-top: -10px;" 
                  onerror="this.style.display='none';">
              <div class="card-body">
                <h5 class="card-title">${nomeVisualizzato}</h5>
                ${showTechnicalName && strip.nomeCommerciale ? `<p class="card-subtitle mb-2 text-muted">${technicalNameDisplay}</p>` : ''}
                <p class="card-text small">
                  ${infoText}
                </p>
                <p class="card-text small">Potenza: ${potenza}</p>
              </div>
            </div>
          </div>
        `;
      });
      
      stripHtml += '</div>';
      
      $('#strip-led-compatibili-container').html(stripHtml);

      if (data.strip_led.length === 1) {
        const stripId = data.strip_led[0].id;
        const nomeCommerciale = data.strip_led[0].nomeCommerciale || '';
        configurazione.stripLedSceltaFinale = stripId;
        configurazione.nomeCommercialeStripLed = nomeCommerciale;
        configurazione.stripLedSelezionata = stripId;
        
        $('.strip-led-compatibile-card').addClass('selected');
        $('#btn-continua-step3').prop('disabled', false);
      }
    },
    error: function(error) {
      console.error("Errore dettagliato:", error);
      $('#strip-led-compatibili-container').html(`
        <div class="col-12 text-center">
          <p class="text-danger">Errore nel caricamento delle strip LED compatibili.</p>
          <p>URL: /get_strip_led_filtrate/${profiloId}/${tensione}/${ip}/${temperatura}/${encodeURIComponent(potenza)}</p>
          <p>Status: ${error.status} - ${error.statusText}</p>
        </div>`);
    }
  });
}

export function caricaOpzioniAlimentatore(tipoAlimentazione) {

  let tensioneStripLed = configurazione.tensioneSelezionato;

  if (configurazione.modalitaConfigurazione === 'solo_strip' && !tensioneStripLed) {
    tensioneStripLed = configurazione.tensione || '24V';
    configurazione.tensioneSelezionato = tensioneStripLed;
  }

  const tipoAlimentazioneBackend = {
    'ON-OFF': 'ON-OFF',
    'DIMMERABILE_TRIAC': 'DIMMERABILE_TRIAC',
    'SENZA_ALIMENTATORE': 'SENZA_ALIMENTATORE'
  }[tipoAlimentazione] || tipoAlimentazione;

  const potenzaConsigliata = configurazione.potenzaConsigliataAlimentatore ? parseInt(configurazione.potenzaConsigliataAlimentatore) : 0;
    
  $('#alimentatore-container').html('<div class="col-12 text-center"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento opzioni alimentatore...</p></div>');

  $.ajax({
    url: `/get_opzioni_alimentatore/${tipoAlimentazioneBackend}/${tensioneStripLed}/${potenzaConsigliata}`,
    method: 'GET',
    success: function(data) {

      $('#alimentatore-container').empty();
      
      if (!data.success) {
        console.error("❌ API ha ritornato success=false:", data.message || 'Nessun messaggio');
        $('#alimentatore-container').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento delle opzioni alimentatore.</p></div>');
        return;
      }
      
      const alimentatori = data.alimentatori;
      
      if (!alimentatori || alimentatori.length === 0) {
        console.warn("⚠️ Nessun alimentatore trovato nella risposta");
        $('#alimentatore-container').html('<div class="col-12 text-center"><p>Nessun alimentatore disponibile per questo tipo di alimentazione e tensione strip LED.</p></div>');
        return;
      }

      if (configurazione.potenzaConsigliataAlimentatore) {
        $('#potenza-consigliata').text(configurazione.potenzaConsigliataAlimentatore);
        $('#potenza-consigliata-section').show();
      }

      const isPRF080or101 = (configurazione.profiloSelezionato === 'PRF080_200' || 
                             configurazione.profiloSelezionato === 'PRF101_200');

      if (isPRF080or101) {
        $('#alimentatore-container').append(`
          <div class="col-12 mb-3">
            <div class="alert alert-info">
              <strong>Nota:</strong> Per i profili PRF080 e PRF101, la serie ATSIP44 può essere inserita all'interno del profilo.
            </div>
          </div>
        `);
      }
      
      alimentatori.forEach(function(alimentatore) {
        const imgPath = `/static/img/${alimentatore.id.toLowerCase()}.jpg`;
        const extraClass = (isPRF080or101 && alimentatore.id === 'SERIE_ATSIP44') ? ' highlight-alimentatore' : '';
        
        $('#alimentatore-container').append(`
          <div class="col-md-4 mb-3 alimentatore-column">
            <div class="card option-card alimentatore-card${extraClass}" data-alimentatore="${alimentatore.id}">
              <img src="${imgPath}" class="card-img-top" alt="${alimentatore.nome}" 
                   style="height: 180px; object-fit: cover;" 
                   onerror="this.src='/static/img/placeholder_logo.jpg'; this.style.height='180px'">
              <div class="card-body">
                <h5 class="card-title">${alimentatore.nome}</h5>
                <p class="card-text small text-muted">${alimentatore.descrizione}</p>
                ${(isPRF080or101 && alimentatore.id === 'SERIE_ATSIP44') ? 
                  '<p class="card-text small fw-bold" style="color: #e83f34;" >Questa tipologia di driver può essere inserita all\'interno del profilo.</p>' : ''}
              </div>
            </div>
          </div>
        `);
      });

      if (alimentatori.length === 1) {
        const $unicoAlimentatore = $('.alimentatore-card');
        $unicoAlimentatore.addClass('selected');
        configurazione.tipologiaAlimentatoreSelezionata = alimentatori[0].id;

        caricaPotenzeAlimentatore(alimentatori[0].id);
      }
      
      $('.alimentatore-card').on('click', function() {
        $('.alimentatore-card').removeClass('selected');
        $(this).addClass('selected');
        
        const alimentatoreId = $(this).data('alimentatore');
        configurazione.tipologiaAlimentatoreSelezionata = alimentatoreId;

        caricaPotenzeAlimentatore(alimentatoreId);
      });
    },
    error: function(xhr, status, error) {
      console.error("❌ Errore AJAX alimentatori:", {
        status: xhr.status,
        statusText: xhr.statusText,
        responseText: xhr.responseText,
        error: error
      });
      $('#alimentatore-container').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento delle opzioni alimentatore. Riprova più tardi.</p></div>');
    }
  });
}

export function caricaPotenzeAlimentatore(alimentatoreId) {
  
  $('#potenza-alimentatore-container').html('<div class="col-12 text-center"><div class="spinner-border" role="status"></div><p class="mt-3">Caricamento potenze disponibili...</p></div>');
  $('#potenza-alimentatore-section').show();
  
  configurazione.potenzaAlimentatoreSelezionata = null;

  $('#btn-continua-step4').prop('disabled', true);
  
  $.ajax({
    url: `/get_potenze_alimentatore/${alimentatoreId}`,
    method: 'GET',
    success: function(data) {
      
      $('#potenza-alimentatore-container').empty();
      
      if (!data.success) {
        $('#potenza-alimentatore-container').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento delle potenze disponibili.</p></div>');
        return;
      }
      
      const potenze = data.potenze;
      
      if (!potenze || potenze.length === 0) {
        $('#potenza-alimentatore-container').html('<div class="col-12 text-center"><p>Nessuna potenza disponibile per questo alimentatore.</p></div>');
        return;
      }

      const potenzaConsigliata = configurazione.potenzaConsigliataAlimentatore ? parseInt(configurazione.potenzaConsigliataAlimentatore) : 0;
      const potenzeOrdinate = [...potenze].sort((a, b) => a - b);

      let potenzaConsigliataProssima = null;
      if (potenzaConsigliata > 0) {
        potenzaConsigliataProssima = potenzeOrdinate.find(p => p >= potenzaConsigliata);
      }

      const potenzeAdeguate = potenzaConsigliata 
        ? potenzeOrdinate.filter(p => p >= potenzaConsigliata) 
        : potenzeOrdinate;
      
      potenzeAdeguate.forEach(function(potenza) {
        const isConsigliata = potenza === potenzaConsigliata;
        const isProssimaConsigliata = potenza === potenzaConsigliataProssima && potenza !== potenzaConsigliata;

        let badgeText = '';
        if (isConsigliata) {
          badgeText = '<span class="badge bg-success ms-2">Consigliata</span>';
        } else if (isProssimaConsigliata) {
          badgeText = '<span class="badge bg-success ms-2">Potenza consigliata</span>';
        }

        $('#potenza-alimentatore-container').append(`
          <div class="col-md-3 mb-3">
            <div class="card option-card potenza-alimentatore-card" data-potenza="${potenza}">
              <div class="card-body text-center">
                <h5 class="card-title">${potenza}W ${badgeText}</h5>
              </div>
            </div>
          </div>
        `);
      });

      const potenzeMostrate = $('.potenza-alimentatore-card');
      if (potenzeMostrate.length === 1) {
        const $unicaPotenza = $(potenzeMostrate[0]);
        $unicaPotenza.addClass('selected');
        configurazione.potenzaAlimentatoreSelezionata = $unicaPotenza.data('potenza');
        $('#btn-continua-step4').prop('disabled', false);
      }

      else {
        configurazione.potenzaAlimentatoreSelezionata = null;
        $('#btn-continua-step4').prop('disabled', true);

        if (potenzaConsigliata) {
          $('#potenza-alimentatore-info')
            .html(`<p>In base alla tua configurazione, la potenza consigliata è di <strong>${potenzaConsigliata}W</strong>, ma puoi selezionare la potenza che preferisci tra quelle disponibili.</p>`)
            .show();
        }
      }

      $('.potenza-alimentatore-card').on('click', function() {
        $('.potenza-alimentatore-card').removeClass('selected');
        $(this).addClass('selected');
        
        configurazione.potenzaAlimentatoreSelezionata = $(this).data('potenza');

        $('#btn-continua-step4').prop('disabled', false);
      });
    },
    error: function(error) {
      console.error("Errore nel caricamento delle potenze disponibili:", error);
      $('#potenza-alimentatore-container').html('<div class="col-12 text-center"><p class="text-danger">Errore nel caricamento delle potenze disponibili. Riprova più tardi.</p></div>');
    }
  });
}

export function caricaFinitureDisponibili(profiloId) {
  
  $('.finitura-card').removeClass('selected');
  configurazione.finituraSelezionata = null;
  
  $.ajax({
    url: `/get_finiture/${profiloId}`,
    method: 'GET',
    success: function(data) {
      
      if (!data.success) {
        $('.finitura-card').parent().show();
        return;
      }
      
      const finitureDisponibili = data.finiture.map(f => f.id);
      
      $('.finitura-card').parent().hide();
      
      finitureDisponibili.forEach(function(finituraId) {
        $(`.finitura-card[data-finitura="${finituraId}"]`).parent().show();
      });
      
      if (finitureDisponibili.length === 0) {
        $('.finitura-card').parent().show();
      }

      if (finitureDisponibili.length === 1) {
        setTimeout(function() {
          const $unicaFinitura = $(`.finitura-card[data-finitura="${finitureDisponibili[0]}"]`);
          
          if ($unicaFinitura.length > 0) {
            $unicaFinitura.addClass('selected');
            configurazione.finituraSelezionata = finitureDisponibili[0];
            checkPersonalizzazioneCompletion();
          }
        }, 50);
      }
    },
    error: function(error) {
      console.error("Errore nel caricamento delle finiture:", error);
      $('.finitura-card').parent().show();
    }
  });
}

export function finalizzaConfigurazione() {
  
  $('#riepilogo-container').html('<div class="text-center my-5"><div class="spinner-border" role="status"></div><p class="mt-3">Generazione riepilogo...</p></div>');
  
  $("#step6-proposte").fadeOut(300, function() {
    $("#step7-riepilogo").fadeIn(300);
    
    updateProgressBar(6);

    if (configurazione.tipologiaSelezionata === 'profilo_intero' && configurazione.lunghezzaProfiloIntero) {
      configurazione.lunghezzaRichiesta = configurazione.lunghezzaProfiloIntero;
    }

    if (configurazione.dimmerSelezionato) {
      const mappaDimmerText = {
        'NESSUN_DIMMER': 'Nessun dimmer',
        'TOUCH_SU_PROFILO': 'Touch su profilo',
        'CON_TELECOMANDO': 'Con telecomando',
        'CENTRALINA_TUYA': 'Centralina TUYA',
        'DIMMER_A_PULSANTE_SEMPLICE': 'Dimmer a pulsante semplice',
        'DIMMERABILE_PWM': 'Dimmerabile PWM',
        'DIMMERABILE_DALI': 'Dimmerabile DALI'
      };

      if (configurazione.tensioneSelezionato === '220V' && configurazione.dimmerSelezionato === 'DIMMER_A_PULSANTE_SEMPLICE') {
        configurazione.dimmerText = 'CTR130 - Dimmerabile TRIAC tramite pulsante e sistema TUYA';
      } else {
        configurazione.dimmerText = mappaDimmerText[configurazione.dimmerSelezionato] || configurazione.dimmerSelezionato;
      }
    }

    if (configurazione.tensioneSelezionato === '220V') {
      configurazione.alimentazioneText = 'Strip 220V (no alimentatore)';
    } else if (configurazione.alimentazioneSelezionata) {
      const mappaAlimentazioneText = {
        'ON-OFF': 'ON/OFF',
        'DIMMERABILE_TRIAC': 'Dimmerabile TRIAC',
        'SENZA_ALIMENTATORE': 'Senza alimentatore'
      };
      configurazione.alimentazioneText = mappaAlimentazioneText[configurazione.alimentazioneSelezionata] || configurazione.alimentazioneSelezionata;
    }
    
    $.ajax({
      url: '/finalizza_configurazione',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(configurazione),
      success: function(data) {
        
        if (!data.success) {
          $('#riepilogo-container').html('<div class="alert alert-danger">Errore nella finalizzazione della configurazione. Riprova più tardi.</div>');
          return;
        }
        
        const riepilogo = data.riepilogo;
        const potenzaTotale = data.potenzaTotale;
        const codiceProdotto = data.codiceProdotto;
        const tuttiCodici = calcolaCodiceProdottoCompleto();
        
        if (configurazione.modalitaConfigurazione === 'solo_strip') {
          let riepilogoHtml = `
            <div class="card">
              <div class="card-header bg-primary text-white">
                <h4>Riepilogo della configurazione - Solo Strip LED</h4>
                <h6>Codice prodotto: ${codiceProdotto}</h6>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-6">
                    <table class="table table-striped">
                      <tbody>
                        <tr>
                          <th scope="row">Strip LED</th>
                          <td>${configurazione.nomeCommercialeStripLed || configurazione.stripLedSelezionata} - ${tuttiCodici.stripLed}</td>
                        </tr>
                        <tr>
                          <th scope="row">Lunghezza</th>
                          <td>${configurazione.lunghezzaRichiestaMetri}m</td>
                        </tr>
                        <tr>
                          <th scope="row">Potenza</th>
                          <td>${configurazione.potenzaSelezionata}</td>
                        </tr>
                        <tr>
                          <th scope="row">Alimentazione</th>
                          <td>${configurazione.alimentazioneText || configurazione.alimentazioneSelezionata}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="col-md-6">
                    <table class="table table-striped">
                      <tbody>
                        <tr>
                          <th scope="row">Dimmer</th>
                          <td>${configurazione.dimmerText || configurazione.dimmerSelezionato}${tuttiCodici.dimmer}</td>
                        </tr>
                        <tr>
                          <th scope="row">Potenza totale</th>
                          <td>${potenzaTotale}W</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          `;
          
          $('#riepilogo-container').html(riepilogoHtml);
          initRiepilogoOperationsListeners(codiceProdotto);
          return;
        }

        let riepilogoHtml = `
          <div class="card">
            <div class="card-header bg-primary text-white">
              <h4>Riepilogo della configurazione</h4>
              <h6>Codice prodotto: ${codiceProdotto}</h6>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <table class="table table-striped">
                    <tbody>
                      <tr>
                        <th scope="row">Categoria</th>
                        <td>${mappaCategorieVisualizzazione[riepilogo.categoriaSelezionata] || riepilogo.categoriaSelezionata}</td>
                      </tr>
                      <tr>
                        <th scope="row">Modello</th>
                        <td>${riepilogo.nomeModello} - ${tuttiCodici.profilo}</td>
                      </tr>
                      <tr>
                        <th scope="row">Tipologia</th>
                        <td>${mappaTipologieVisualizzazione[riepilogo.tipologiaSelezionata] || riepilogo.tipologiaSelezionata}</td>
                      </tr>
        `;

        if (riepilogo.formaDiTaglioSelezionata === 'DRITTO_SEMPLICE') {
          if (riepilogo.lunghezzaRichiesta) {
            riepilogoHtml += `
                      <tr>
                        <th scope="row">Lunghezza richiesta</th>
                        <td>${riepilogo.lunghezzaRichiesta}mm</td>
                      </tr>
            `;
          }
        } else {
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
          
          const etichette = etichetteLati[riepilogo.formaDiTaglioSelezionata] || {};
          
          if (riepilogo.lunghezzeMultiple) {
            Object.entries(riepilogo.lunghezzeMultiple).forEach(([lato, valore]) => {
              if (valore) {
                const etichetta = etichette[lato] || `Lato ${lato.replace('lato', '')}`;
                riepilogoHtml += `
                        <tr>
                          <th scope="row">${etichetta}</th>
                          <td>${valore}mm</td>
                        </tr>
                `;
              }
            });
          }

          riepilogoHtml += `
                      <tr>
                        <th scope="row">Nota</th>
                        <td class="text-danger">I profili verranno consegnati non assemblati tra di loro e la strip verrà consegnata non installata.</td>
                      </tr>
          `;
        }

        if (riepilogo.stripLedSelezionata === 'NO_STRIP' || !riepilogo.includeStripLed) {
          riepilogoHtml += `
                      <tr>
                        <th scope="row">Strip LED</th>
                        <td>Senza Strip LED</td>
                      </tr>
          `;
        } else {
          const nomeStripLed = riepilogo.nomeCommercialeStripLed || 
                             mappaStripLedVisualizzazione[riepilogo.stripLedSelezionata] || 
                             riepilogo.stripLedSelezionata;
          
          riepilogoHtml += `
                      <tr>
                        <th scope="row">Strip LED</th>
                        <td>${nomeStripLed} - ${tuttiCodici["stripLed"]}</td>
                      </tr>
          `;

          if (riepilogo.tipologiaStripSelezionata) {
            let tipologiaStripText = mappaTipologiaStripVisualizzazione[riepilogo.tipologiaStripSelezionata] || riepilogo.tipologiaStripSelezionata;
            if (riepilogo.tipologiaStripSelezionata === 'SPECIAL' && riepilogo.specialStripSelezionata) {
            tipologiaStripText += ` - ${mappaSpecialStripVisualizzazione[riepilogo.specialStripSelezionata] || riepilogo.specialStripSelezionata}`;
            }
            
            riepilogoHtml += `
                      <tr>
                        <th scope="row">Tipologia Strip</th>
                        <td>${tipologiaStripText}</td>
                      </tr>
            `;
          }
          
          if (riepilogo.potenzaSelezionata) {
            riepilogoHtml += `
                      <tr>
                        <th scope="row">Potenza</th>
                        <td>${riepilogo.potenzaSelezionata}</td>
                      </tr>
            `;
          }
        }

        if (riepilogo.tensioneSelezionato === '220V') {
          riepilogoHtml += `
                      <tr>
                        <th scope="row">Alimentazione</th>
                        <td>Strip 220V (no alimentatore)</td>
                      </tr>
          `;
        } else if (riepilogo.alimentazioneSelezionata) {
          const alimentazioneText = riepilogo.alimentazioneText || 
                                  (riepilogo.alimentazioneSelezionata === 'SENZA_ALIMENTATORE' ? 'Senza alimentatore' : 
                                   riepilogo.alimentazioneSelezionata.replace('_', ' '));
          
          riepilogoHtml += `
                      <tr>
                        <th scope="row">Alimentazione</th>
                        <td>${alimentazioneText}</td>
                      </tr>
          `;
          
          if (riepilogo.alimentazioneSelezionata !== 'SENZA_ALIMENTATORE' && riepilogo.tipologiaAlimentatoreSelezionata) {
            riepilogoHtml += `
                      <tr>
                        <th scope="row">Alimentatore</th>
                        <td>${riepilogo.tipologiaAlimentatoreSelezionata} - ${tuttiCodici.alimentatore} </td>
                      </tr>
            `;
            
            if (riepilogo.potenzaConsigliataAlimentatore) {
              riepilogoHtml += `
                      <tr>
                        <th scope="row">Potenza consigliata</th>
                        <td>${riepilogo.potenzaConsigliataAlimentatore}W</td>
                      </tr>
              `;
            }
          }
        }
        
        riepilogoHtml += `
                    </tbody>
                  </table>
                </div>
                <div class="col-md-6">
                  <table class="table table-striped">
                    <tbody>
        `;

        if (riepilogo.dimmerSelezionato) {
          const dimmerText = riepilogo.dimmerText.replace(/_/g, ' ') || 
                           (riepilogo.dimmerSelezionato === 'NESSUN_DIMMER' ? 'Nessun dimmer' : 
                            riepilogo.dimmerSelezionato.replace(/_/g, ' '));
          
          riepilogoHtml += `
                    <tr>
                      <th scope="row">Dimmer</th>
                      <td>${dimmerText}${tuttiCodici.dimmer}</td>
                    </tr>
          `;

          if (riepilogo.dimmerSelezionato === 'TOUCH_SU_PROFILO') {
            riepilogoHtml += `
                    <tr>
                      <th scope="row">Nota dimmer</th>
                      <td class="text-warning">Spazio non illuminato di 50mm per touch su profilo</td>
                    </tr>
            `;
          }
        }
        
        if (riepilogo.tipoAlimentazioneCavo) {
          riepilogoHtml += `
                    <tr>
                      <th scope="row">Alimentazione cavo</th>
                      <td>${riepilogo.tipoAlimentazioneCavo === 'ALIMENTAZIONE_UNICA' ? 'Alimentazione unica' : 'Alimentazione doppia'}</td>
                    </tr>
          `;
          
          if (riepilogo.lunghezzaCavoIngresso) {
            riepilogoHtml += `
                    <tr>
                      <th scope="row">Lunghezza cavo ingresso</th>
                      <td>${riepilogo.lunghezzaCavoIngresso}mm</td>
                    </tr>
            `;
          }
          
          if (riepilogo.tipoAlimentazioneCavo === 'ALIMENTAZIONE_DOPPIA' && riepilogo.lunghezzaCavoUscita) {
            riepilogoHtml += `
                    <tr>
                      <th scope="row">Lunghezza cavo uscita</th>
                      <td>${riepilogo.lunghezzaCavoUscita}mm</td>
                    </tr>
            `;
          }
          
          if (riepilogo.uscitaCavoSelezionata) {
            let uscitaCavoText = riepilogo.uscitaCavoSelezionata;
            if (uscitaCavoText === 'DRITTA') uscitaCavoText = 'Dritta';
            else if (uscitaCavoText === 'LATERALE_DX') uscitaCavoText = 'Laterale destra';
            else if (uscitaCavoText === 'LATERALE_SX') uscitaCavoText = 'Laterale sinistra';
            else if (uscitaCavoText === 'RETRO') uscitaCavoText = 'Retro';
            
            if (configurazione.categoriaSelezionata != "esterni" && configurazione.categoriaSelezionata != "wall_washer_ext") {
              riepilogoHtml += `
                      <tr>
                        <th scope="row">Uscita cavo</th>
                        <td>${uscitaCavoText}</td>
                      </tr>
              `;
            }
          }
        }

        riepilogoHtml += `
                    <tr>
                      <th scope="row">Forma di taglio</th>
                      <td>${mappaFormeTaglio[riepilogo.formaDiTaglioSelezionata] || riepilogo.formaDiTaglioSelezionata}</td>
                    </tr>
                    <tr>
                      <th scope="row">Finitura</th>
                      <td>${mappaFiniture[riepilogo.finituraSelezionata] || riepilogo.finituraSelezionata}</td>
                    </tr>
        `;

        if (riepilogo.lunghezzaRichiesta) {
          riepilogoHtml += `
                    <tr>
                      <th scope="row">Lunghezza richiesta</th>
                      <td>${riepilogo.lunghezzaRichiesta}mm</td>
                    </tr>
          `;
        }

        if (riepilogo.stripLedSelezionata !== 'NO_STRIP' && riepilogo.includeStripLed && potenzaTotale) {
          riepilogoHtml += `
                    <tr>
                      <th scope="row">Potenza totale</th>
                      <td>${potenzaTotale}W</td>
                    </tr>
          `;
        }
        
        riepilogoHtml += `
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="text-center mt-4">`;

        if (riepilogo.categoriaSelezionata === 'esterni' || riepilogo.categoriaSelezionata === 'wall_washer_ext') {
          riepilogoHtml += `
            <div class="alert alert-info">
              <p class="mb-0"><strong>ATTENZIONE:</strong> la lunghezza richiesta fa riferimento alla strip led esclusa di tappi e il profilo risulterà leggermente più corto.</p>
            </div>`;
        }
        else {
          riepilogoHtml += `
            <div class="alert alert-info">
              <p mb-0><strong>NOTA:</strong> Verrà aggiunto automaticamente uno spazio di 5mm per i tappi e la saldatura.</p>
            </div>`;
        }
        
        riepilogoHtml += `
            <div class="alert alert-warning mt-3">
              <strong>Attenzione:</strong> eventuali staffe aggiuntive non incluse.
            </div>
            <button class="btn btn-success btn-lg" id="btn-salva-configurazione">Salva configurazione</button>
            <!-- <button class="btn btn-primary btn-lg" id="btn-preventivo">Richiedi preventivo</button> -->
          </div>
        </div>
        </div>
        `;
        
        $('#riepilogo-container').html(riepilogoHtml);

        initRiepilogoOperationsListeners(codiceProdotto);
      },
      error: function(error) {
        console.error("Errore nella finalizzazione della configurazione:", error);
        $('#riepilogo-container').html('<div class="alert alert-danger">Errore nella finalizzazione della configurazione. Riprova più tardi.</div>');
      }
    });
  });
}

export function richiediPreventivo(codiceProdotto) {
  alert(`La richiesta di preventivo per il prodotto ${codiceProdotto} è stata inviata al nostro team. Verrai contattato al più presto.`);
}
