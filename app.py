from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import os
import json
from database import DatabaseManager
from datetime import datetime
import tempfile
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import logging
import math

app = Flask(__name__)
CORS(app)

db = DatabaseManager()
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_categorie')
def get_categorie():
    try:
        categorie = db.get_categorie()
        return jsonify(categorie)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_profili/<categoria>')
def get_profili(categoria):
    try:
        profili = db.get_profili_by_categoria(categoria)

        tutti_strip_ids = set()
        for profilo in profili:
            strip_ids = profilo.get('stripLedCompatibili', [])
            tutti_strip_ids.update(strip_ids)

        strip_led_map = {}
        if tutti_strip_ids:
            strip_ids_list = list(tutti_strip_ids)

            strip_data_response = db.supabase.table('strip_led')\
                .select('id, nome_commerciale')\
                .in_('id', strip_ids_list)\
                .execute()

            if strip_data_response.data:
                for strip in strip_data_response.data:
                    strip_led_map[strip['id']] = {
                        'id': strip['id'],
                        'nomeCommerciale': strip.get('nome_commerciale', '')
                    }

        for profilo in profili:
            strip_compatibili_info = []
            for strip_id in profilo.get('stripLedCompatibili', []):
                if strip_id in strip_led_map:
                    strip_compatibili_info.append(strip_led_map[strip_id])
            profilo['stripLedCompatibiliInfo'] = strip_compatibili_info
        
        return jsonify(profili)
    except Exception as e:
        logging.error(f"Errore in get_profili: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_opzioni_profilo/<profilo_id>')
def get_opzioni_profilo(profilo_id):
    try:
        profilo_data = db.supabase.table('profili').select('*').eq('id', profilo_id).single().execute().data
        
        if not profilo_data:
            return jsonify({'tipologie': []})
            
        tipologie = db.supabase.table('profili_tipologie').select('tipologia').eq('profilo_id', profilo_id).execute().data
        
        return jsonify({
            'tipologie': [t['tipologia'] for t in tipologie]
        })
    except Exception as e:
        return jsonify({'tipologie': []})

@app.route('/get_opzioni_tensione/<profilo_id>')
@app.route('/get_opzioni_tensione/<profilo_id>/<tipologia_strip>')
def get_opzioni_tensione(profilo_id, tipologia_strip=None):
    try:
        if profilo_id == 'ESTERNI':
            voltaggi_disponibili = ['24V', '48V', '220V']
            if tipologia_strip == 'SPECIAL':
                voltaggi_disponibili = ['24V']
            return jsonify({'success': True, 'voltaggi': voltaggi_disponibili})
        
        strip_compatibili = db.supabase.table('profili_strip_compatibili').select('strip_id').eq('profilo_id', profilo_id).execute().data
        strip_ids = [s['strip_id'] for s in strip_compatibili]
        
        if not strip_ids:
            return jsonify({'success': True, 'voltaggi': []})
        
        query = db.supabase.table('strip_led').select('tensione')
        
        if tipologia_strip:
            query = query.eq('tipo', tipologia_strip)
        
        strips = query.in_('id', strip_ids).execute().data
        
        voltaggi_disponibili = list(set([s['tensione'] for s in strips]))
        
        return jsonify({'success': True, 'voltaggi': voltaggi_disponibili})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_opzioni_ip/<profilo_id>/<tensione>')
@app.route('/get_opzioni_ip/<profilo_id>/<tensione>/<tipologia_strip>')
def get_opzioni_ip(profilo_id, tensione, tipologia_strip=None):
    try:
        strip_compatibili = db.supabase.table('profili_strip_compatibili').select('strip_id').eq('profilo_id', profilo_id).execute().data
        strip_ids = [s['strip_id'] for s in strip_compatibili]
        
        if not strip_ids:
            return jsonify({'success': True, 'ip': []})
        
        query = db.supabase.table('strip_led').select('ip').eq('tensione', tensione)
        
        if tipologia_strip:
            query = query.eq('tipo', tipologia_strip)
        
        strips = query.in_('id', strip_ids).execute().data
        
        ip_disponibili = list(set([s['ip'] for s in strips]))
        
        return jsonify({'success': True, 'ip': ip_disponibili})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_opzioni_temperatura_iniziale/<profilo_id>/<tensione>/<ip>')
@app.route('/get_opzioni_temperatura_iniziale/<profilo_id>/<tensione>/<ip>/<tipologia_strip>')
def get_opzioni_temperatura_iniziale(profilo_id, tensione, ip, tipologia_strip=None):
    try:
        strip_compatibili = db.supabase.table('profili_strip_compatibili').select('strip_id').eq('profilo_id', profilo_id).execute().data
        strip_ids = [s['strip_id'] for s in strip_compatibili]
        
        if not strip_ids:
            return jsonify({'success': True, 'temperature': []})
        
        query = db.supabase.table('strip_led').select('id').eq('tensione', tensione).eq('ip', ip)
        
        if tipologia_strip:
            query = query.eq('tipo', tipologia_strip)
        
        strips = query.in_('id', strip_ids).execute().data
        
        temperature_disponibili = set()
        for strip in strips:
            temps = db.supabase.table('strip_temperature').select('temperatura').eq('strip_id', strip['id']).execute().data
            for t in temps:
                temperature_disponibili.add(t['temperatura'])
        
        return jsonify({'success': True, 'temperature': list(temperature_disponibili)})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_temperature_colore/<profilo_id>/<tipologia>/<tensione>/<ip>')
def get_temperature_colore(profilo_id, tipologia, tensione, ip):
    try:
        strips = db.get_strip_led_filtrate(profilo_id, tensione, ip, None, None, tipologia)
        
        temperature = set()
        for strip in strips:
            for temp in strip.get('temperaturaColoreDisponibili', []):
                temperature.add(temp)
        
        temperature_list = list(temperature)
        temperature_list.sort()
        
        return jsonify({'success': True, 'temperature': temperature_list})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_opzioni_potenza/<profilo_id>/<tensione>/<ip>/<temperatura>')
@app.route('/get_opzioni_potenza/<profilo_id>/<tensione>/<ip>/<temperatura>/<tipologia_strip>')
def get_opzioni_potenza(profilo_id, tensione, ip, temperatura, tipologia_strip=None):
    try:
        # AGGIUNGI QUESTO LOG ALL'INIZIO
        logging.info(f"=== DEBUG get_opzioni_potenza ===")
        logging.info(f"Parametri ricevuti: profilo_id={profilo_id}, tensione={tensione}, ip={ip}, temperatura={temperatura}, tipologia_strip={tipologia_strip}")
        
        # Verifica se il profilo esiste
        profilo_check = db.supabase.table('profili').select('id, nome').eq('id', profilo_id).execute()
        logging.info(f"Verifica profilo: {profilo_check.data}")
        
        # Verifica compatibilità prima di chiamare la funzione principale
        strip_compatibili_check = db.supabase.table('profili_strip_compatibili')\
            .select('strip_id')\
            .eq('profilo_id', profilo_id)\
            .execute().data
        logging.info(f"Strip compatibili trovate (diretta): {len(strip_compatibili_check)}")
        
        # Per gli esterni, cerca tutte le strip senza filtrare per profilo
        if profilo_id == 'ESTERNI':
            logging.info("Modalità ESTERNI - usando get_all_strip_led_filtrate")
            strips = db.get_all_strip_led_filtrate(tensione, ip, temperatura, None, tipologia_strip)
        else:
            logging.info("Modalità normale - usando get_strip_led_filtrate")
            strips = db.get_strip_led_filtrate(profilo_id, tensione, ip, temperatura, None, tipologia_strip)
        
        logging.info(f"Strip trovate dopo filtro: {len(strips)}")
        
        tutte_potenze_disponibili = set()
        for strip in strips:
            potenze_strip = strip.get('potenzeDisponibili', [])
            logging.info(f"Strip {strip.get('id', 'N/A')}: potenze = {potenze_strip}")
            tutte_potenze_disponibili.update(potenze_strip)
        
        logging.info(f"Tutte le potenze raccolte: {tutte_potenze_disponibili}")
        
        if not tutte_potenze_disponibili:
            logging.warning("NESSUNA POTENZA DISPONIBILE!")
            return jsonify({'success': False, 'message': 'Nessuna potenza disponibile per i parametri selezionati'})
        
        potenze_complete = []
        for potenza in tutte_potenze_disponibili:
            potenze_complete.append({
                'id': potenza,
                'nome': potenza,
                'codice': '',
                'specifiche': ''
            })
        
        logging.info(f"Ritornando {len(potenze_complete)} potenze")
        return jsonify({'success': True, 'potenze': potenze_complete})
        
    except Exception as e:
        logging.error(f"ERRORE GRAVE in get_opzioni_potenza: {str(e)}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_strip_led_filtrate/<profilo_id>/<tensione>/<ip>/<temperatura>/<potenza>')
@app.route('/get_strip_led_filtrate/<profilo_id>/<tensione>/<ip>/<temperatura>/<potenza>/<tipologia>')
def get_strip_led_filtrate(profilo_id, tensione, ip, temperatura, potenza, tipologia=None):
    try:
        if potenza:
            potenza = potenza.replace('-', ' ').replace('_', '/')
        
        # Per gli esterni, cerca tutte le strip senza filtrare per profilo
        if profilo_id == 'ESTERNI':
            strips = db.get_all_strip_led_filtrate(tensione, ip, temperatura, potenza, tipologia)
        else:
            strips = db.get_strip_led_filtrate(profilo_id, tensione, ip, temperatura, potenza, tipologia)
        
        return jsonify({'success': True, 'strip_led': strips})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_opzioni_alimentatore/<tipo_alimentazione>/<tensione_strip>')
@app.route('/get_opzioni_alimentatore/<tipo_alimentazione>/<tensione_strip>/<int:potenza_consigliata>')
def get_opzioni_alimentatore(tipo_alimentazione, tensione_strip, potenza_consigliata=None):
    try:
        alimentatori = db.get_alimentatori_by_tipo(tipo_alimentazione, tensione_strip)
        
        if potenza_consigliata:
            alimentatori_filtrati = []
            for alim in alimentatori:
                potenze_adatte = [p for p in alim.get('potenze', []) if p >= potenza_consigliata]
                if potenze_adatte:
                    alim['potenza_consigliata'] = min(potenze_adatte)
                    alimentatori_filtrati.append(alim)
        else:
            alimentatori_filtrati = alimentatori
        
        dettagli_alimentatori = {alim['id']: alim for alim in alimentatori}
        
        return jsonify({
            'success': True,
            'alimentatori': alimentatori_filtrati,
            'dettagliAlimentatori': dettagli_alimentatori
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_potenze_alimentatore/<alimentatore_id>')
def get_potenze_alimentatore(alimentatore_id):
    try:
        potenze = db.get_potenze_alimentatore(alimentatore_id)
        return jsonify({'success': True, 'potenze': potenze})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_dettagli_alimentatore/<alimentatore_id>')
def get_dettagli_alimentatore(alimentatore_id):
    try:
        alimentatore = db.get_dettagli_alimentatore(alimentatore_id)
        
        if alimentatore:
            return jsonify({'success': True, 'alimentatore': alimentatore})
        else:
            return jsonify({'success': False, 'message': 'Alimentatore non trovato'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_opzioni_dimmerazione/<strip_id>')
def get_opzioni_dimmerazione(strip_id):
    try:
        result = db.get_dimmer_compatibili(strip_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_dimmer_compatibili/<strip_id>')
def get_dimmer_compatibili(strip_id):
    try:
        result = db.get_dimmer_compatibili(strip_id)
        dimmer_compatibili = [d for d in result.get('opzioni', []) if d != 'NESSUN_DIMMER']
        return jsonify({'success': True, 'dimmer_compatibili': dimmer_compatibili})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_finiture/<profilo_id>')
def get_finiture(profilo_id):
    try:
        finiture = db.supabase.table('profili_finiture').select('finitura').eq('profilo_id', profilo_id).execute().data
        finiture_list = [f['finitura'] for f in finiture]
        
        mappatura_finiture = {
            'ALLUMINIO_ANODIZZATO': 'Alluminio anodizzato',
            'BIANCO': 'Bianco',
            'NERO': 'Nero',
            'ALLUMINIO': 'Alluminio'
        }
        
        finiture_formattate = [
            {
                'id': finitura,
                'nome': mappatura_finiture.get(finitura, finitura)
            }
            for finitura in finiture_list
        ]
        
        return jsonify({'success': True, 'finiture': finiture_formattate})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/calcola_potenza_alimentatore', methods=['POST'])
def calcola_potenza_alimentatore():
    data = request.json
    potenza_per_metro = data.get('potenzaPerMetro', 0)
    lunghezza_metri = data.get('lunghezzaMetri', 0)
    potenza_totale = potenza_per_metro * lunghezza_metri * 1.2
    potenze_standard = [30, 60, 100, 150, 200, 320]
    potenza_consigliata = next((p for p in potenze_standard if p >= potenza_totale), potenze_standard[-1])
    
    return jsonify({
        'success': True,
        'potenzaTotale': round(potenza_totale, 2),
        'potenzaConsigliata': potenza_consigliata
    })

@app.route('/calcola_potenza_consigliata', methods=['POST'])
def calcola_potenza_consigliata():
    try:
        data = request.json
        
        potenza_strip = float(data.get('potenzaStrip', 0))
        lunghezza = float(data.get('lunghezza', 0))
        alimentazione_doppia = data.get('alimentazioneDoppia', False)
        
        potenza_totale = (potenza_strip * lunghezza) / 1000
        
        if alimentazione_doppia:
            potenza_totale = potenza_totale / 2
        
        potenza_consigliata = potenza_totale * 1.2
        potenza_consigliata = int((potenza_consigliata + 4) / 5) * 5
        
        return jsonify({
            'success': True,
            'potenzaConsigliata': potenza_consigliata,
            'potenzaTotale': potenza_totale
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_strip_compatibile_standalone', methods=['POST'])
def get_strip_compatibile_standalone():
    """Trova una strip reale dal database invece di generare ID fittizi"""
    try:
        data = request.json
        
        tipologia = data.get('tipologia')
        tensione = data.get('tensione')
        ip = data.get('ip')
        temperatura = data.get('temperatura')
        potenza = data.get('potenza')
        special = data.get('special')
        
        logging.info(f"=== get_strip_compatibile_standalone ===")
        logging.info(f"Parametri: tipologia={tipologia}, tensione={tensione}, ip={ip}, temperatura={temperatura}, potenza={potenza}, special={special}")
        
        # Costruisci la query per trovare strip reali
        query = db.supabase.table('strip_led').select('*')
        query = query.eq('tensione', tensione).eq('ip', ip)
        
        # Applica filtri per tipologia
        if tipologia == 'SPECIAL' and special:
            # Per special strip, filtra per nome commerciale/id
            if special == 'XMAGIS':
                query = query.or_('nome_commerciale.ilike.%XMAGIS%,id.ilike.%XMAGIS%,nome_commerciale.ilike.%MG13X12%,nome_commerciale.ilike.%MG12X17%')
            elif special == 'XFLEX':
                query = query.or_('nome_commerciale.ilike.%XFLEX%,id.ilike.%XFLEX%')
            elif special == 'XSNAKE':
                query = query.or_('nome_commerciale.ilike.%XSNAKE%,id.ilike.%XSNAKE%,id.ilike.%SNK%')
            elif special == 'ZIG_ZAG':
                query = query.or_('nome_commerciale.ilike.%ZIGZAG%,id.ilike.%ZIGZAG%,nome_commerciale.ilike.%ZIG_ZAG%')
        elif tipologia and tipologia != 'None':
            query = query.eq('tipo', tipologia)
        
        strips = query.execute().data
        logging.info(f"Strip trovate: {len(strips)}")
        
        if not strips:
            return jsonify({
                'success': False, 
                'message': 'Nessuna strip trovata per i parametri specificati'
            })
        
        # Filtra per temperatura se specificata
        if temperatura:
            strip_ids = [s['id'] for s in strips]
            temp_check = db.supabase.table('strip_temperature')\
                .select('strip_id')\
                .eq('temperatura', temperatura)\
                .in_('strip_id', strip_ids)\
                .execute().data
            
            strip_ids_con_temp = [t['strip_id'] for t in temp_check]
            strips = [s for s in strips if s['id'] in strip_ids_con_temp]
            logging.info(f"Strip dopo filtro temperatura: {len(strips)}")
        
        # Filtra per potenza se specificata
        if potenza:
            strip_ids = [s['id'] for s in strips]
            potenza_check = db.supabase.table('strip_potenze')\
                .select('strip_id')\
                .eq('potenza', potenza)\
                .in_('strip_id', strip_ids)\
                .execute().data
            
            strip_ids_con_potenza = [p['strip_id'] for p in potenza_check]
            strips = [s for s in strips if s['id'] in strip_ids_con_potenza]
            logging.info(f"Strip dopo filtro potenza: {len(strips)}")
        
        if not strips:
            return jsonify({
                'success': False, 
                'message': 'Nessuna strip trovata dopo tutti i filtri'
            })
        
        # Prendi la prima strip che corrisponde ai criteri
        strip_scelta = strips[0]
        logging.info(f"Strip scelta: {strip_scelta['id']} - {strip_scelta.get('nome_commerciale', '')}")
        
        return jsonify({
            'success': True,
            'strip_led': {
                'id': strip_scelta['id'],  # ✅ ID REALE dal database
                'nomeCommerciale': strip_scelta.get('nome_commerciale', ''),
                'nome': strip_scelta.get('nome', ''),
                'tensione': strip_scelta.get('tensione', ''),
                'ip': strip_scelta.get('ip', ''),
                'tipo': strip_scelta.get('tipo', '')
            }
        })
        
    except Exception as e:
        logging.error(f"Errore in get_strip_compatibile_standalone: {str(e)}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'success': False, 'message': str(e)})


# 2. Sostituisci calcola_lunghezze con questa versione COMPLETA:

@app.route('/calcola_lunghezze', methods=['POST'])
def calcola_lunghezze():
    data = request.json
    dim_richiesta = data.get('lunghezzaRichiesta', 0)
    strip_id = data.get('stripLedSelezionata')
    potenza_selezionata = data.get('potenzaSelezionata')
    lunghezze_multiple = data.get('lunghezzeMultiple', {})
    forma_taglio = data.get('formaDiTaglioSelezionata', 'DRITTO_SEMPLICE')
    
    logging.info(f"=== calcola_lunghezze ===")
    logging.info(f"dim_richiesta={dim_richiesta}, strip_id={strip_id}, potenza={potenza_selezionata}")
    
    taglio_minimo = 1
    spazio_produzione = 5

    # ✅ PROTEZIONE: Gestisci il caso strip non trovata
    if strip_id and strip_id != 'NO_STRIP' and potenza_selezionata:
        try:
            # Prova a cercare la strip nel database
            strip_data_result = db.supabase.table('strip_led').select('*').eq('id', strip_id).execute()
            
            if strip_data_result.data and len(strip_data_result.data) > 0:
                # Strip trovata
                strip_info = strip_data_result.data[0]  # Prendi il primo risultato
                tagli_minimi = strip_info.get('taglio_minimo', [])
                logging.info(f"Strip trovata: {strip_id}, tagli_minimi: {tagli_minimi}")

                # Continua con la logica esistente per il taglio minimo
                potenze_data = db.supabase.table('strip_potenze').select('*').eq('strip_id', strip_id).order('indice').execute()
                if potenze_data.data:
                    indice_potenza = -1
                    for record in potenze_data.data:
                        if record.get('potenza') == potenza_selezionata:
                            indice_potenza = record.get('indice', -1)
                            break

                    if indice_potenza >= 0 and indice_potenza < len(tagli_minimi):
                        taglio_minimo_str = tagli_minimi[indice_potenza]
                        import re
                        match = re.search(r'(\d+(?:[.,]\d+)?)', taglio_minimo_str)
                        if match:
                            taglio_minimo_val = match.group(1).replace(',', '.')
                            try:
                                taglio_minimo = float(taglio_minimo_val)
                                logging.info(f"Taglio minimo calcolato: {taglio_minimo}")
                            except ValueError:
                                logging.warning(f"Impossibile convertire taglio_minimo: {taglio_minimo_val}")
                                pass
            else:
                # Strip non trovata nel database
                logging.warning(f"Strip non trovata nel database: {strip_id}")
                logging.info("Usando taglio minimo default: 1")
                
        except Exception as e:
            # Errore nella ricerca della strip
            logging.error(f"Errore nella ricerca della strip {strip_id}: {str(e)}")
            logging.info("Usando taglio minimo default: 1")

    def calcola_proposte_singole(lunghezza):
        if lunghezza > 0:
            proposta1 = int((lunghezza - 5) // taglio_minimo * taglio_minimo) + 5
            proposta2 = int((((lunghezza - 5) + taglio_minimo - 0.01) // taglio_minimo) * taglio_minimo) + 5

            if proposta2 <= proposta1:
                proposta2 = int(proposta1 + taglio_minimo)
        else:
            proposta1 = 0
            proposta2 = 0
        
        return proposta1, proposta2

    def calcola_spazio_buio_lato(valore_originale, proposta1, proposta2):
        if valore_originale == proposta1 or valore_originale == proposta2:
            return 0

        if proposta1 < valore_originale < proposta2:
            return valore_originale - proposta1

        if valore_originale < proposta1:
            return 0

        if valore_originale > proposta2:
            return valore_originale - proposta2
        
        return 0

    if forma_taglio != 'DRITTO_SEMPLICE' and lunghezze_multiple:
        proposte_per_lato = {}
        
        for lato, lunghezza in lunghezze_multiple.items():
            if lunghezza and lunghezza > 0:
                prop1, prop2 = calcola_proposte_singole(lunghezza)
                proposte_per_lato[lato] = {
                    'originale': lunghezza,
                    'proposta1': prop1,
                    'proposta2': prop2
                }

        import itertools
        
        lati_ordinati = sorted(proposte_per_lato.keys())
        combinazioni = []
        opzioni_per_lato = []
        for lato in lati_ordinati:
            opzioni = []
            props = proposte_per_lato[lato]
            
            if props['proposta1'] != props['originale']:
                opzioni.append(('proposta1', props['proposta1']))
            
            if props['proposta2'] != props['originale'] and props['proposta2'] != props['proposta1']:
                opzioni.append(('proposta2', props['proposta2']))
            
            opzioni.append(('originale', props['originale']))
            opzioni_per_lato.append(opzioni)

        for combinazione in itertools.product(*opzioni_per_lato):
            combo_dict = {}
            combo_label_parts = []
            lunghezza_totale = 0
            spazio_buio_totale = 0
            
            for i, (tipo, valore) in enumerate(combinazione):
                lato = lati_ordinati[i]
                combo_dict[lato] = valore
                lunghezza_totale += valore

                props = proposte_per_lato[lato]
                spazio_buio_lato = calcola_spazio_buio_lato(
                    props['originale'], 
                    props['proposta1'], 
                    props['proposta2']
                ) if tipo == 'originale' else 0
                
                spazio_buio_totale += spazio_buio_lato

                if tipo == 'originale':
                    combo_label_parts.append(f"Orig.")
                elif tipo == 'proposta1':
                    combo_label_parts.append(f"Prop.1")
                else:
                    combo_label_parts.append(f"Prop.2")
            
            combinazioni.append({
                'lunghezze': combo_dict,
                'lunghezza_totale': lunghezza_totale,
                'label': " + ".join(combo_label_parts),
                'ha_spazio_buio': spazio_buio_totale > 0,
                'spazio_buio_totale': spazio_buio_totale,
                'dettaglio': combinazione
            })

        combinazioni.sort(key=lambda x: (x['ha_spazio_buio'], x['spazio_buio_totale'], x['lunghezza_totale']))
        
        return jsonify({
            'success': True,
            'tipo': 'combinazioni',
            'spazioProduzione': spazio_produzione,
            'proposte_per_lato': proposte_per_lato,
            'combinazioni': combinazioni[:27]
        })
    
    else:
        if dim_richiesta > 0:
            proposta1, proposta2 = calcola_proposte_singole(dim_richiesta)
        else:
            proposta1 = 0
            proposta2 = 0
        
        return jsonify({
            'success': True,
            'tipo': 'semplice',
            'spazioProduzione': spazio_produzione,
            'proposte': {
                'proposta1': proposta1,
                'proposta2': proposta2
            }
        })

@app.route('/finalizza_configurazione', methods=['POST'])
def finalizza_configurazione():
    configurazione = request.json
    
    potenza_per_metro = 0
    if 'potenzaSelezionata' in configurazione and configurazione['potenzaSelezionata']:
        potenza_str = configurazione['potenzaSelezionata'].split('W/m')[0]
        try:
            potenza_per_metro = float(potenza_str)
        except ValueError:
            potenza_per_metro = 0
    
    lunghezza_in_metri = 0
    if 'lunghezzaRichiesta' in configurazione and configurazione['lunghezzaRichiesta']:
        try:
            lunghezza_in_metri = float(configurazione['lunghezzaRichiesta']) / 1000
        except ValueError:
            lunghezza_in_metri = 0
    
    potenza_totale = potenza_per_metro * lunghezza_in_metri
    
    # ✅ NUOVO: Calcolo delle quantità necessarie
    quantita_profilo = 1
    quantita_strip_led = 1
    lunghezza_massima_profilo = 3000  # default
    lunghezza_massima_strip = 5000    # default
    
    # Calcolare la lunghezza totale richiesta
    lunghezza_totale = 0
    if 'lunghezzeMultiple' in configurazione and configurazione['lunghezzeMultiple']:
        # Forme complesse: somma di tutti i lati
        lunghezza_totale = sum(v for v in configurazione['lunghezzeMultiple'].values() if v and v > 0)
    elif 'lunghezzaRichiesta' in configurazione and configurazione['lunghezzaRichiesta']:
        # Forme semplici
        lunghezza_totale = float(configurazione['lunghezzaRichiesta'])
    
    logging.info(f"Lunghezza totale calcolata: {lunghezza_totale}mm")
    
    # Recuperare lunghezza massima del profilo dal database
    if 'profiloSelezionato' in configurazione and configurazione['profiloSelezionato']:
        try:
            # Recupera le lunghezze disponibili per il profilo
            lunghezze_profilo = db.supabase.table('profili_lunghezze')\
                .select('lunghezza')\
                .eq('profilo_id', configurazione['profiloSelezionato'])\
                .execute().data
            
            if lunghezze_profilo:
                lunghezze_list = [l['lunghezza'] for l in lunghezze_profilo]
                lunghezza_massima_profilo = max(lunghezze_list)
                logging.info(f"Lunghezza massima profilo: {lunghezza_massima_profilo}mm")
                
                # Calcola quantità profilo
                if lunghezza_totale > 0:
                    quantita_profilo = math.ceil(lunghezza_totale / lunghezza_massima_profilo)
        except Exception as e:
            logging.error(f"Errore nel recupero lunghezza profilo: {str(e)}")
    
    # Recuperare lunghezza massima della strip LED dal database
    if 'stripLedSelezionata' in configurazione and configurazione['stripLedSelezionata'] and configurazione['stripLedSelezionata'] not in ['NO_STRIP', 'senza_strip']:
        try:
            strip_data = db.supabase.table('strip_led')\
                .select('lunghezza')\
                .eq('id', configurazione['stripLedSelezionata'])\
                .single()\
                .execute()
            
            if strip_data.data and strip_data.data.get('lunghezza'):
                lunghezza_massima_strip = strip_data.data['lunghezza']
                logging.info(f"Lunghezza massima strip: {lunghezza_massima_strip}mm")
                
                # Calcola quantità strip LED
                if lunghezza_totale > 0:
                    quantita_strip_led = math.ceil(lunghezza_totale / (lunghezza_massima_strip * 1000))
        except Exception as e:
            logging.error(f"Errore nel recupero lunghezza strip: {str(e)}")
    
    logging.info(f"Quantità calcolate - Profilo: {quantita_profilo}, Strip LED: {quantita_strip_led}")
    
    # ✅ CORREZIONE: Gestisci il codice prodotto in base alla modalità
    modalita = configurazione.get('modalitaConfigurazione', '')
    
    if modalita == 'solo_strip':
        # Per il flusso solo strip, usa il codice della strip LED
        strip_led = configurazione.get('stripLedSelezionata', '')
        nome_commerciale = configurazione.get('nomeCommercialeStripLed', '')
        
        if nome_commerciale:
            codice_prodotto = nome_commerciale
        elif strip_led:
            codice_prodotto = strip_led
        else:
            codice_prodotto = 'Strip LED'
    else:
        # Per il flusso normale, usa il profilo
        profilo = configurazione.get('profiloSelezionato', '')
        codice_prodotto = profilo if profilo else 'Configurazione'
    
    return jsonify({
        'success': True,
        'riepilogo': configurazione,
        'potenzaTotale': round(potenza_totale, 2),
        'codiceProdotto': codice_prodotto,
        # ✅ NUOVO: Aggiungere le quantità alla risposta
        'quantitaProfilo': quantita_profilo,
        'quantitaStripLed': quantita_strip_led,
        'lunghezzaMassimaProfilo': lunghezza_massima_profilo,
        'lunghezzaMassimaStripLed': lunghezza_massima_strip,
        'lunghezzaTotale': lunghezza_totale
    })

@app.route('/salva_configurazione', methods=['POST'])
def salva_configurazione():
    try:
        data = request.json
        
        saved = db.salva_configurazione(
            configurazione=data.get('configurazione'),
            codice_prodotto=data.get('codice_prodotto'),
            email=data.get('email'),
            telefono=data.get('telefono'),
            note=data.get('note')
        )
        
        if saved:
            try:
                excel_path = genera_excel_configurazione(
                    data.get('configurazione'),
                    data.get('codice_prodotto')
                )
                
                return jsonify({
                    'success': True,
                    'id': saved['id'],
                    'message': 'Configurazione salvata con successo',
                    'excel_path': excel_path
                })
            except Exception as excel_error:
                return jsonify({
                    'success': True,
                    'id': saved['id'],
                    'message': 'Configurazione salvata (errore generazione Excel)',
                    'error_detail': str(excel_error)
                })
        
        return jsonify({'success': False, 'message': 'Errore nel salvataggio'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/download_excel/<filename>')
def download_excel(filename):
    try:
        filepath = os.path.join(tempfile.gettempdir(), filename)
        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 404

def genera_excel_configurazione(configurazione, codice_prodotto):
    wb = Workbook()
    ws = wb.active
    ws.title = "Configurazione REDO"
    
    header_font = Font(bold=True, size=14, color="FFFFFF")
    header_fill = PatternFill(start_color="E83F34", end_color="E83F34", fill_type="solid")
    
    subheader_font = Font(bold=True, size=12)
    subheader_fill = PatternFill(start_color="F0F0F0", end_color="F0F0F0", fill_type="solid")
    
    border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    ws.merge_cells('A1:D1')
    ws['A1'] = f"Configurazione REDO - {codice_prodotto}"
    ws['A1'].font = header_font
    ws['A1'].fill = header_fill
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    
    ws['A2'] = "Data:"
    ws['B2'] = datetime.now().strftime("%d/%m/%Y %H:%M")
    
    row = 4
    
    sezioni = [
        ("Profilo", ["categoria", "profilo", "tipologia", "finitura"]),
        ("Strip LED", ["strip", "temperatura", "potenza", "tensione", "ip"]),
        ("Alimentazione", ["tipoAlimentazione", "tipoAlimentatore", "potenzaAlimentatore"]),
        ("Dimmerazione", ["dimmer"]),
        ("Cablaggio", ["uscitaCavo", "lunghezzaCavoIngresso", "lunghezzaCavoUscita"]),
        ("Dimensioni", ["forma", "lunghezzaTotale", "lunghezze"])
    ]
    
    for sezione, campi in sezioni:
        ws.merge_cells(f'A{row}:D{row}')
        ws[f'A{row}'] = sezione
        ws[f'A{row}'].font = subheader_font
        ws[f'A{row}'].fill = subheader_fill
        row += 1
        
        for campo in campi:
            if campo in configurazione:
                valore = configurazione[campo]
                
                if isinstance(valore, dict):
                    valore = json.dumps(valore, ensure_ascii=False)
                elif isinstance(valore, list):
                    valore = ", ".join(map(str, valore))
                elif valore is None:
                    valore = "N/A"
                
                ws[f'A{row}'] = campo.replace('_', ' ').title()
                ws[f'B{row}'] = str(valore)
                ws.merge_cells(f'B{row}:D{row}')
                
                for col in ['A', 'B', 'C', 'D']:
                    ws[f'{col}{row}'].border = border
                
                row += 1
        
        row += 1
    
    ws.merge_cells(f'A{row}:D{row}')
    ws[f'A{row}'] = "Calcoli e Note"
    ws[f'A{row}'].font = subheader_font
    ws[f'A{row}'].fill = subheader_fill
    row += 1
    
    if 'calcoliLunghezza' in configurazione:
        calcoli = configurazione['calcoliLunghezza']
        ws[f'A{row}'] = "Spazio Buio:"
        ws[f'B{row}'] = f"{calcoli.get('spazioBuio', 0)} mm"
        row += 1
        
        ws[f'A{row}'] = "Taglio Strip:"
        ws[f'B{row}'] = f"ogni {calcoli.get('taglioMinimo', 0)} mm"
        row += 1
    
    ws.column_dimensions['A'].width = 25
    ws.column_dimensions['B'].width = 30
    ws.column_dimensions['C'].width = 20
    ws.column_dimensions['D'].width = 20
    
    filename = f"REDO_Config_{codice_prodotto}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    filepath = os.path.join(tempfile.gettempdir(), filename)
    wb.save(filepath)
    
    return filename

# Aggiungi questi nuovi endpoint in app.py

@app.route('/get_tipologie_strip_disponibili')
def get_tipologie_strip_disponibili():
    """Ottiene tutte le tipologie di strip disponibili nel database"""
    try:
        # Ottieni tutte le tipologie distinte dal database
        tipologie_data = db.supabase.table('strip_led').select('tipo').execute().data
        tipologie_uniche = list(set([t['tipo'] for t in tipologie_data if t['tipo']]))
        
        return jsonify({'success': True, 'tipologie': tipologie_uniche})
    except Exception as e:
        logging.error(f"Errore in get_tipologie_strip_disponibili: {str(e)}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_special_strip_disponibili')
def get_special_strip_disponibili():
    """Ottiene tutte le special strip disponibili nel database"""
    try:
        # Ottieni tutte le strip con nomi commerciali
        strips_data = db.supabase.table('strip_led').select('nome_commerciale, id').execute().data
        
        special_strips = set()
        
        # Definisci le keywords per identificare le special strip
        special_keywords = {
            'XFLEX': ['XFLEX', 'FLEX'],
            'XSNAKE': ['XSNAKE', 'SNAKE', 'SNK'],
            'XMAGIS': ['XMAGIS', 'MAGIS', 'MG13X12', 'MG12X17'],
            'ZIG_ZAG': ['ZIGZAG', 'ZIG_ZAG', 'ZIG-ZAG']
        }
        
        # Cerca le special strip nel database
        for strip in strips_data:
            nome_commerciale = (strip.get('nome_commerciale') or '').upper()
            strip_id = (strip.get('id') or '').upper()
            
            for special_type, keywords in special_keywords.items():
                if any(keyword in nome_commerciale or keyword in strip_id for keyword in keywords):
                    special_strips.add(special_type)
                    break
        
        return jsonify({'success': True, 'special_strips': list(special_strips)})
    except Exception as e:
        logging.error(f"Errore in get_special_strip_disponibili: {str(e)}")
        return jsonify({'success': False, 'message': str(e)})

# Sostituisci l'endpoint esistente get_opzioni_strip_standalone con questo:
@app.route('/get_opzioni_strip_standalone', methods=['POST'])
def get_opzioni_strip_standalone():
    """Ottiene le tensioni disponibili dal database per tipologia e special strip"""
    try:
        data = request.json
        tipologia = data.get('tipologia')
        special = data.get('special')
        
        logging.info(f"get_opzioni_strip_standalone chiamata con: tipologia={tipologia}, special={special}")
        
        # Interroga il database per le tensioni disponibili
        query = db.supabase.table('strip_led').select('tensione')
        
        if tipologia and tipologia != 'None':
            if tipologia == 'SPECIAL':
                # Per special strip, filtra per nome commerciale/id
                if special:
                    if special == 'XMAGIS':
                        query = query.or_('nome_commerciale.ilike.%XMAGIS%,id.ilike.%XMAGIS%,nome_commerciale.ilike.%MG13X12%,nome_commerciale.ilike.%MG12X17%')
                    elif special == 'XFLEX':
                        query = query.or_('nome_commerciale.ilike.%XFLEX%,id.ilike.%XFLEX%')
                    elif special == 'XSNAKE':
                        query = query.or_('nome_commerciale.ilike.%XSNAKE%,id.ilike.%XSNAKE%,id.ilike.%SNK%')
                    elif special == 'ZIG_ZAG':
                        query = query.or_('nome_commerciale.ilike.%ZIGZAG%,id.ilike.%ZIGZAG%,nome_commerciale.ilike.%ZIG_ZAG%')
                else:
                    # Se SPECIAL ma senza tipo specifico, cerca tutte le special strip
                    special_keywords = ['XFLEX', 'XSNAKE', 'XMAGIS', 'ZIGZAG', 'ZIG_ZAG', 'MG13X12', 'MG12X17', 'SNK']
                    or_conditions = []
                    for keyword in special_keywords:
                        or_conditions.extend([f"nome_commerciale.ilike.%{keyword}%", f"id.ilike.%{keyword}%"])
                    query = query.or_(','.join(or_conditions))
            else:
                # Per tipologie normali (COB, SMD)
                query = query.eq('tipo', tipologia)
        
        strips = query.execute().data
        logging.info(f"Strip trovate: {len(strips)}")
        
        if not strips:
            return jsonify({'success': True, 'tensioni': []})
        
        # Estrai tensioni uniche
        tensioni_uniche = list(set([s['tensione'] for s in strips if s['tensione']]))
        
        # Ordina le tensioni numericamente
        def get_tensione_order(tensione):
            try:
                return int(tensione.replace('V', ''))
            except:
                return 999
        
        tensioni_ordinate = sorted(tensioni_uniche, key=get_tensione_order)
        
        logging.info(f"Tensioni disponibili nel DB: {tensioni_ordinate}")
        
        return jsonify({'success': True, 'tensioni': tensioni_ordinate})
    except Exception as e:
        logging.error(f"Errore in get_opzioni_strip_standalone: {str(e)}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_opzioni_ip_standalone', methods=['POST'])
def get_opzioni_ip_standalone():
    try:
        data = request.get_json()
        logging.info(f"DEBUG IP - Dati ricevuti: {data}")
        
        if not data:
            return jsonify({'success': False, 'message': 'Nessun dato ricevuto'})
        
        tipologia = data.get('tipologia', '')
        tensione = data.get('tensione', '')
        special = data.get('special')
        
        logging.info(f"DEBUG IP - Parametri estratti: tipologia={tipologia}, tensione={tensione}, special={special}")

        # Costruisci la query base per trovare le strip LED
        query = db.supabase.table('strip_led').select('ip')\
            .eq('tensione', tensione)
        
        # Applica filtro per tipologia se presente
        if tipologia and tipologia != 'None':
            query = query.eq('tipo', tipologia)
        
        # Applica filtri per special strip se presente
        if tipologia == 'SPECIAL' and special:
            logging.info(f"DEBUG IP - Caso SPECIAL con special={special}")
            
            # Resetta la query per applicare i filtri OR per le special strip
            query = db.supabase.table('strip_led').select('ip')\
                .eq('tensione', tensione)
            
            if special == 'XMAGIS':
                query = query.or_('nome_commerciale.ilike.%XMAGIS%,id.ilike.%XMAGIS%,nome_commerciale.ilike.%MG13X12%,nome_commerciale.ilike.%MG12X17%')
            elif special == 'XFLEX':
                query = query.or_('nome_commerciale.ilike.%XFLEX%,id.ilike.%XFLEX%')
            elif special == 'XSNAKE':
                query = query.or_('nome_commerciale.ilike.%XSNAKE%,id.ilike.%XSNAKE%,id.ilike.%SNK%')
            elif special == 'ZIG_ZAG':
                query = query.or_('nome_commerciale.ilike.%ZIGZAG%,id.ilike.%ZIGZAG%,nome_commerciale.ilike.%ZIG_ZAG%')
        
        # Esegui la query
        strips = query.execute().data
        logging.info(f"DEBUG IP - Strip trovate: {len(strips)}")
        
        if not strips:
            logging.warning("DEBUG IP - Nessuna strip trovata per i parametri specificati")
            return jsonify({'success': True, 'gradi_ip': []})
        
        # Estrai tutti gli IP unici dalle strip trovate
        ip_disponibili = list(set([strip['ip'] for strip in strips if strip['ip']]))
        
        # Ordina gli IP (IP20 < IP65 < IP66 < IP67)
        def get_ip_order(ip):
            ip_order = {'IP20': 1, 'IP44': 2, 'IP65': 3, 'IP66': 4, 'IP67': 5}
            return ip_order.get(ip, 999)
        
        ip_ordinati = sorted(ip_disponibili, key=get_ip_order)
        
        logging.info(f"DEBUG IP - IP disponibili trovati nel DB: {ip_ordinati}")
        
        return jsonify({
            'success': True, 
            'gradi_ip': ip_ordinati,
            'debug': {
                'strips_trovate': len(strips),
                'ip_unici': len(ip_disponibili),
                'parametri': {
                    'tipologia': tipologia,
                    'tensione': tensione,
                    'special': special
                }
            }
        })
        
    except Exception as e:
        logging.error(f"DEBUG IP - ERRORE: {str(e)}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'success': False, 'message': f'Errore interno: {str(e)}'})

@app.route('/get_opzioni_temperatura_standalone', methods=['POST'])
def get_opzioni_temperatura_standalone():
    try:
        data = request.get_json()
        logging.info(f"DEBUG TEMPERATURA - Dati ricevuti: {data}")
        
        if not data:
            return jsonify({'success': False, 'message': 'Nessun dato ricevuto'})
        
        tipologia = data.get('tipologia', '')
        tensione = data.get('tensione', '')
        ip = data.get('ip', '')
        special = data.get('special')
        categoria = data.get('categoria')  # Nuovo parametro per gestire meglio il filtro
        
        logging.info(f"DEBUG TEMPERATURA - Parametri estratti: tipologia={tipologia}, tensione={tensione}, ip={ip}, special={special}, categoria={categoria}")

        # Costruisci la query base
        strips = []
        
        if tipologia == 'SPECIAL' and special:
            logging.info(f"DEBUG TEMPERATURA - Ricerca SPECIAL strip: {special}")
            
            # Per special strip, usa una strategia più robusta
            query = db.supabase.table('strip_led')\
                .select('id, nome_commerciale, tensione, ip, tipo')\
                .eq('tensione', tensione)\
                .eq('ip', ip)
            
            all_strips = query.execute().data
            
            # Filtra per special strip
            special_keywords = {
                'XMAGIS': ['XMAGIS', 'MAGIS', 'MG13X12', 'MG12X17'],
                'XFLEX': ['XFLEX', 'FLEX'],
                'XSNAKE': ['XSNAKE', 'SNAKE', 'SNK'],
                'ZIG_ZAG': ['ZIGZAG', 'ZIG_ZAG', 'ZIG-ZAG'],
            }
            
            keywords = special_keywords.get(special, [])
            
            for strip in all_strips:
                nome_commerciale = (strip.get('nome_commerciale') or '').upper()
                strip_id = (strip.get('id') or '').upper()
                
                # Verifica se la strip contiene una delle keywords
                if any(keyword in nome_commerciale or keyword in strip_id for keyword in keywords):
                    strips.append(strip)
                    logging.info(f"DEBUG TEMPERATURA - Special strip trovata: {strip_id} ({nome_commerciale})")
            
        else:
            # Per tipologie normali (COB, SMD)
            query = db.supabase.table('strip_led').select('id, nome_commerciale, tensione, ip, tipo')\
                .eq('tensione', tensione)\
                .eq('ip', ip)
            
            if tipologia and tipologia not in ['None', 'SPECIAL']:
                query = query.eq('tipo', tipologia)
            
            strips = query.execute().data
            logging.info(f"DEBUG TEMPERATURA - Strip normali trovate: {len(strips)}")
        
        logging.info(f"DEBUG TEMPERATURA - Strip finali dopo tutti i filtri: {len(strips)}")
        
        if not strips:
            logging.warning("DEBUG TEMPERATURA - Nessuna strip trovata per i parametri specificati")
            return jsonify({'success': True, 'temperature': []})
        
        # Estrai gli ID delle strip trovate
        strip_ids = [s['id'] for s in strips]
        logging.info(f"DEBUG TEMPERATURA - Strip IDs finali: {strip_ids}")
        
        # Cerca le temperature disponibili per queste strip
        temperature_data = db.supabase.table('strip_temperature')\
            .select('temperatura')\
            .in_('strip_id', strip_ids)\
            .execute().data
        
        logging.info(f"DEBUG TEMPERATURA - Temperature data trovate: {len(temperature_data)}")
        
        if not temperature_data:
            logging.warning("DEBUG TEMPERATURA - Nessuna temperatura trovata per le strip")
            return jsonify({'success': True, 'temperature': []})
        
        # Estrai temperature uniche
        temperature_uniche = list(set([t['temperatura'] for t in temperature_data if t['temperatura']]))
        
        # Ordina le temperature logicamente
        def get_temperatura_order(temp):
            if 'K' in temp and temp.replace('K', '').isdigit():
                return (0, int(temp.replace('K', '')))  # Temperature Kelvin prime, ordinate numericamente
            elif temp == 'CCT':
                return (1, 0)  # CCT dopo le temperature fisse
            elif temp == 'RGB':
                return (2, 0)  # RGB dopo CCT
            elif temp == 'RGBW':
                return (3, 0)  # RGBW per ultimo
            else:
                return (4, 0)  # Altre temperature non riconosciute
        
        temperature_ordinate = sorted(temperature_uniche, key=get_temperatura_order)
        
        logging.info(f"DEBUG TEMPERATURA - Temperature disponibili nel DB: {temperature_ordinate}")
        
        return jsonify({
            'success': True, 
            'temperature': temperature_ordinate,
            'debug': {
                'strips_trovate': len(strips),
                'temperature_records': len(temperature_data),
                'temperature_uniche': len(temperature_uniche),
                'parametri': {
                    'tipologia': tipologia,
                    'tensione': tensione,
                    'ip': ip,
                    'special': special,
                    'categoria': categoria
                }
            }
        })
        
    except Exception as e:
        logging.error(f"DEBUG TEMPERATURA - ERRORE: {str(e)}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'success': False, 'message': f'Errore interno: {str(e)}'})

@app.route('/get_opzioni_potenza_standalone', methods=['POST'])
def get_opzioni_potenza_standalone():
    try:
        data = request.json
        tipologia = data.get('tipologia')
        special = data.get('special')
        tensione = data.get('tensione')
        ip = data.get('ip')
        temperatura = data.get('temperatura')
        
        # Prima trova le strip che corrispondono ai criteri
        query = db.supabase.table('strip_led').select('id')\
            .eq('tensione', tensione)\
            .eq('ip', ip)
        
        # Applica filtri per special strip
        strips = query.execute().data
        if tipologia == 'SPECIAL' and special:
            if special == 'XMAGIS':
                query = query.or_('nome_commerciale.ilike.%XMAGIS%,id.ilike.%XMAGIS%,nome_commerciale.ilike.%MG13X12%,nome_commerciale.ilike.%MG12X17%')
            elif special == 'XFLEX':
                query = query.or_('nome_commerciale.ilike.%XFLEX%,id.ilike.%XFLEX%')
            elif special == 'XSNAKE':
                query = query.or_('nome_commerciale.ilike.%XSNAKE%,id.ilike.%XSNAKE%,id.ilike.%SNK%')
            elif special == 'ZIG_ZAG':
                query = query.or_('nome_commerciale.ilike.%ZIGZAG%,id.ilike.%ZIGZAG%,nome_commerciale.ilike.%ZIG_ZAG%')
        
        strips = query.execute().data
        
        if not strips:
            return jsonify({'success': True, 'potenze': []})
        
        strip_ids = [s['id'] for s in strips]
        print(strip_ids)
        
        # Filtra per temperatura se specificata
        if temperatura:
            temp_check = db.supabase.table('strip_temperature')\
                .select('strip_id')\
                .eq('temperatura', temperatura)\
                .in_('strip_id', strip_ids)\
                .execute().data
            
            strip_ids = [t['strip_id'] for t in temp_check]
        
        if not strip_ids:
            return jsonify({'success': True, 'potenze': []})
        
        # Ottieni le potenze disponibili
        potenze_data = db.supabase.table('strip_potenze')\
            .select('potenza')\
            .in_('strip_id', strip_ids)\
            .execute().data
        
        # Rimuovi duplicati e ordina
        potenze_uniche = sorted(list(set([p['potenza'] for p in potenze_data])), 
                               key=lambda x: (x.replace('W/m', '').replace(',', '.')))
        
        potenze = [{'id': p, 'nome': p} for p in potenze_uniche]
        
        return jsonify({'success': True, 'potenze': potenze})
        
    except Exception as e:
        logging.error(f"Errore in get_opzioni_potenza_standalone: {str(e)}")
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_strip_led_filtrate_standalone', methods=['POST'])
def get_strip_led_filtrate_standalone():
    try:
        data = request.json

        tipologia = data.get('tipologia')
        special = data.get('special')
        tensione = data.get('tensione')
        ip = data.get('ip')
        temperatura = data.get('temperatura')
        potenza = data.get('potenza')

        # NUOVO APPROCCIO: Per Special Strip, prima cerchiamo la tipologia specifica
        # poi filtriamo per parametri compatibili invece che il contrario
        
        if tipologia == 'SPECIAL' and special:
            
            special_keywords = {
                'XFLEX': ['XFLEX', 'FLEX'],
                'XSNAKE': ['XSNAKE', 'SNAKE'],
                'XMAGIS': ['XMAGIS', 'MAGIS'],
                'ZIG_ZAG': ['ZIGZAG', 'ZIG_ZAG'],
            }
            
            keywords = special_keywords.get(special, [])
            
            if not keywords:
                return jsonify({'success': False, 'message': f'Tipologia special strip non riconosciuta: {special}'})
            
            # Prima trova TUTTE le strip di questo tipo special (senza filtri tensione/IP)
            base_query = db.supabase.table('strip_led').select('*')
            
            or_conditions = []
            for keyword in keywords:
                or_conditions.append(f"nome_commerciale.ilike.%{keyword}%")
                or_conditions.append(f"id.ilike.%{keyword}%")
            
            or_query = ','.join(or_conditions)
            
            special_strips = base_query.or_(or_query).execute().data

            # Ora filtra per tensione (obbligatorio)
            if tensione:
                special_strips = [s for s in special_strips if s['tensione'] == tensione]
            
            # Per IP: se l'utente ha selezionato un IP che non esiste per questa special strip,
            # mostriamo comunque le strip disponibili con i loro IP reali
            if ip:
                strips_con_ip_richiesto = [s for s in special_strips if s['ip'] == ip]
                if strips_con_ip_richiesto:
                    special_strips = strips_con_ip_richiesto

            # Continuiamo con tutte le strip trovate invece di bloccare
            strips = special_strips
            
        else:
            # Logica normale per non-special strip
            query = db.supabase.table('strip_led').select('*')
            
            if tensione:
                query = query.eq('tensione', tensione)
            if ip:
                query = query.eq('ip', ip)
                
            strips = query.execute().data

        
        result = []
        for strip in strips:
            strip_id = strip['id']
            
            # Controllo temperatura
            if temperatura:
                temp_check = db.supabase.table('strip_temperature')\
                    .select('temperatura')\
                    .eq('strip_id', strip_id)\
                    .eq('temperatura', temperatura)\
                    .execute().data
                
                if not temp_check:
                    continue
            
            # Controllo potenza
            if potenza:
                potenza_check = db.supabase.table('strip_potenze')\
                    .select('potenza')\
                    .eq('strip_id', strip_id)\
                    .eq('potenza', potenza)\
                    .execute().data

                if not potenza_check:
                    continue
            
            # Ottieni temperature disponibili
            temperatures = db.supabase.table('strip_temperature')\
                .select('temperatura')\
                .eq('strip_id', strip_id)\
                .execute().data
            
            # Ottieni potenze disponibili
            potenze = db.supabase.table('strip_potenze')\
                .select('potenza, codice_prodotto')\
                .eq('strip_id', strip_id)\
                .order('indice')\
                .execute().data
            
            strip['temperaturaColoreDisponibili'] = [t['temperatura'] for t in temperatures]
            strip['potenzeDisponibili'] = [p['potenza'] for p in potenze]
            strip['codiciProdotto'] = [p['codice_prodotto'] for p in potenze]
            strip['nomeCommerciale'] = strip.get('nome_commerciale', '')
            strip['taglioMinimo'] = strip.get('taglio_minimo', {})
            strip['temperatura'] = temperatura

            result.append(strip)

        return jsonify({'success': True, 'strip_led': result})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get_strip_compatibili_esterni/<categoria>')
def get_strip_compatibili_esterni(categoria):
    try:
        # Ottieni tutti i profili della categoria
        profili = db.get_profili_by_categoria(categoria)
        
        # Raccogli tutte le strip compatibili
        strip_compatibili_totali = set()
        for profilo in profili:
            if 'stripLedCompatibili' in profilo:
                strip_compatibili_totali.update(profilo['stripLedCompatibili'])
        
        # Ottieni i dettagli delle strip compatibili
        if strip_compatibili_totali:
            strip_details = db.supabase.table('strip_led')\
                .select('*')\
                .in_('id', list(strip_compatibili_totali))\
                .execute()
            
            return jsonify({
                'success': True,
                'strip_compatibili': list(strip_compatibili_totali),
                'strip_details': strip_details.data if strip_details.data else []
            })
        else:
            return jsonify({
                'success': True,
                'strip_compatibili': [],
                'strip_details': []
            })
            
    except Exception as e:
        logging.error(f"Errore in get_strip_compatibili_esterni: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/get_strip_led_by_nome_commerciale/<nome_commerciale>')
def get_strip_led_by_nome_commerciale(nome_commerciale):
    try:
        strip_data = db.supabase.table('strip_led').select('*').eq('nome_commerciale', nome_commerciale).single().execute()
        
        if not strip_data.data:
            return jsonify({'success': False, 'message': f'Strip LED non trovata: {nome_commerciale}'})
        
        strip_info = strip_data.data
        
        temperature = db.supabase.table('strip_temperature').select('temperatura').eq('strip_id', strip_info['id']).execute().data
        potenze = db.supabase.table('strip_potenze').select('*').eq('strip_id', strip_info['id']).order('indice').execute().data
        
        return jsonify({
            'success': True,
            'strip_led': {
                'id': strip_info['id'],
                'nome': strip_info['nome'],
                'nomeCommerciale': strip_info.get('nome_commerciale', ''),
                'tensione': strip_info['tensione'],
                'ip': strip_info['ip'],
                'temperaturaColoreDisponibili': [t['temperatura'] for t in temperature],
                'potenzeDisponibili': [p['potenza'] for p in potenze],
                'codiciProdotto': [p['codice_prodotto'] for p in potenze]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'database': 'supabase'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)