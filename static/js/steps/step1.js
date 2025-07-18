import { configurazione, mappaCategorieVisualizzazione } from '../config.js';
import { updateProgressBar } from '../utils.js';
import { caricaProfili } from '../api.js';

export function initStep1Listeners() {
  $('.hotspot').on('click', function() {
    const categoria = $(this).data('categoria');
    if (!categoria) {
      console.error("Nessuna categoria trovata per questo hotspot");
      return;
    }
    configurazione.categoriaSelezionata = categoria;

    if (categoria === 'esterni' || categoria === 'wall_washer_ext') {
        configurazione.isFlussoProfiliEsterni = true;
        
        $('.categoria-selezionata').text(`Categoria: ${mappaCategorieVisualizzazione[categoria] || categoria}`);
        updateProgressBar(2);
        
        $("#step1-tipologia").fadeOut(300, function() {
            $("#step2-tipologia-strip").fadeIn(300);
            import('./step2.js').then(module => {
                module.prepareTipologiaStripListeners();
            });
        });
    } else {
        configurazione.isFlussoProfiliEsterni = false;
        
        $('.categoria-selezionata').text(`Categoria: ${mappaCategorieVisualizzazione[categoria] || categoria}`);
        updateProgressBar(2);
        
        $("#step1-tipologia").fadeOut(300, function() {
            $("#step2-modello").fadeIn(300);
            caricaProfili(categoria);
        });
    }
});
  
  $('.btn-torna-indietro').on('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    $("#step2-modello").fadeOut(300, function() {
      $("#step1-tipologia").fadeIn(300);
      configurazione.categoriaSelezionata = null;
      configurazione.profiloSelezionato = null;
      configurazione.tipologiaSelezionata = null;
      configurazione.stripLedSelezionata = null;
      $('#tipologia-container').hide();
      updateProgressBar(1);
    });
  });
}
