from supabase import create_client, Client
import os
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
import logging
from functools import lru_cache
from datetime import datetime, timedelta
import time

load_dotenv()

class DatabaseManager:
    def __init__(self):
        try:
            supabase_url = os.environ.get('SUPABASE_URL')
            supabase_key = os.environ.get('SUPABASE_KEY')
            
            if not supabase_url or not supabase_key:
                raise ValueError("SUPABASE_URL o SUPABASE_KEY non configurati nel file .env")
            
            self.supabase: Client = create_client(supabase_url, supabase_key)
            self._test_connection()
            
        except Exception as e:
            logging.error(f"Errore inizializzazione database: {str(e)}")
            raise
            
        self._cache = {}
        self._cache_timestamps = {}
        self._cache_duration = timedelta(minutes=30)
    
    def _test_connection(self):
        try:
            result = self.supabase.table('categorie').select('id').limit(1).execute()
            logging.info("✓ Connessione a Supabase verificata con successo")
        except Exception as e:
            logging.error(f"✗ Errore connessione Supabase: {str(e)}")
            raise
    
    def _log_query_time(self, query_name: str, start_time: float):
        elapsed = time.time() - start_time
        if elapsed > 1.0:
            logging.warning(f"Query lenta: {query_name} ha impiegato {elapsed:.2f} secondi")
    
    def _get_from_cache(self, key: str) -> Optional[Any]:
        if key in self._cache:
            if datetime.now() - self._cache_timestamps[key] < self._cache_duration:
                return self._cache[key]
            else:
                del self._cache[key]
                del self._cache_timestamps[key]
        return None
    
    def _set_cache(self, key: str, value: Any):
        self._cache[key] = value
        self._cache_timestamps[key] = datetime.now()
    
    def get_categorie(self) -> List[Dict[str, Any]]:
        cache_key = "all_categorie"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        categorie = self.supabase.table('categorie').select('*').execute().data

        sottofamiglie_data = self.supabase.table('categorie_sottofamiglie')\
            .select('categoria_id, sottofamiglia')\
            .execute().data

        sottofamiglie_map = {}
        for sf in sottofamiglie_data:
            cat_id = sf['categoria_id']
            if cat_id not in sottofamiglie_map:
                sottofamiglie_map[cat_id] = []
            sottofamiglie_map[cat_id].append(sf['sottofamiglia'])

        for categoria in categorie:
            categoria['sottofamiglie'] = sottofamiglie_map.get(categoria['id'], [])
        
        self._set_cache(cache_key, categorie)
        return categorie

    def get_profili_by_categoria(self, categoria: str) -> List[Dict[str, Any]]:
        start_time = time.time()
        
        cache_key = f"profili_categoria_{categoria}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        profili = self.supabase.table('profili')\
            .select('*')\
            .eq('categoria', categoria)\
            .execute().data
        
        if not profili:
            return []

        profili_ids = [p['id'] for p in profili]

        tipologie_data = self.supabase.table('profili_tipologie')\
            .select('profilo_id, tipologia')\
            .in_('profilo_id', profili_ids)\
            .execute().data

        finiture_data = self.supabase.table('profili_finiture')\
            .select('profilo_id, finitura')\
            .in_('profilo_id', profili_ids)\
            .execute().data

        lunghezze_data = self.supabase.table('profili_lunghezze')\
            .select('profilo_id, lunghezza')\
            .in_('profilo_id', profili_ids)\
            .order('lunghezza')\
            .execute().data

        strip_compatibili_data = self.supabase.table('profili_strip_compatibili')\
            .select('profilo_id, strip_id')\
            .in_('profilo_id', profili_ids)\
            .execute().data

        tipologie_map = {}
        for t in tipologie_data:
            pid = t['profilo_id']
            if pid not in tipologie_map:
                tipologie_map[pid] = []
            tipologie_map[pid].append(t['tipologia'])
        
        finiture_map = {}
        for f in finiture_data:
            pid = f['profilo_id']
            if pid not in finiture_map:
                finiture_map[pid] = []
            finiture_map[pid].append(f['finitura'])
        
        lunghezze_map = {}
        for l in lunghezze_data:
            pid = l['profilo_id']
            if pid not in lunghezze_map:
                lunghezze_map[pid] = []
            lunghezze_map[pid].append(l['lunghezza'])
        
        strip_map = {}
        for s in strip_compatibili_data:
            pid = s['profilo_id']
            if pid not in strip_map:
                strip_map[pid] = []
            strip_map[pid].append(s['strip_id'])

        for profilo in profili:
            pid = profilo['id']
            profilo['tipologie'] = tipologie_map.get(pid, [])
            profilo['finitureDisponibili'] = finiture_map.get(pid, [])
            profilo['lunghezzeDisponibili'] = lunghezze_map.get(pid, [])
            profilo['stripLedCompatibili'] = strip_map.get(pid, [])
            
            # ✅ NUOVO: Aggiungere lunghezza massima del profilo
            lunghezze_profilo = lunghezze_map.get(pid, [])
            if lunghezze_profilo:
                profilo['lunghezzaMassima'] = max(lunghezze_profilo)
            else:
                profilo['lunghezzaMassima'] = profilo.get('lunghezza_massima', 3000)  # fallback
        
        self._log_query_time(f"get_profili_by_categoria({categoria})", start_time)
        self._set_cache(cache_key, profili)
        return profili

    def get_strip_led_filtrate(self, profilo_id: str, tensione: str, ip: str, 
                            temperatura: str, potenza: Optional[str] = None,
                            tipologia: Optional[str] = None) -> List[Dict[str, Any]]:
        # DEBUG: Log dei parametri in ingresso
        logging.info(f"get_strip_led_filtrate chiamata con: profilo_id={profilo_id}, tensione={tensione}, ip={ip}, temperatura={temperatura}, potenza={potenza}, tipologia={tipologia}")
        
        # DEBUG: Verifica se il profilo esiste
        profilo_check = self.supabase.table('profili').select('id, nome').eq('id', profilo_id).execute()
        logging.info(f"Profilo trovato: {profilo_check.data}")
        
        strip_compatibili = self.supabase.table('profili_strip_compatibili')\
            .select('strip_id')\
            .eq('profilo_id', profilo_id)\
            .execute().data
        
        # DEBUG: Log delle strip compatibili trovate
        logging.info(f"Strip compatibili trovate per profilo {profilo_id}: {len(strip_compatibili)} strip")
        logging.info(f"Strip IDs: {[s['strip_id'] for s in strip_compatibili]}")
        
        strip_ids = [s['strip_id'] for s in strip_compatibili]
        
        if not strip_ids:
            # DEBUG: Controlla se ci sono dati nella tabella compatibilità
            all_compat = self.supabase.table('profili_strip_compatibili').select('*').limit(10).execute().data
            logging.warning(f"Nessuna strip compatibile trovata per profilo {profilo_id}!")
            logging.info(f"Primi 10 record della tabella compatibilità: {all_compat}")
            return []

        # ✅ MODIFICA: Includere la lunghezza nel select
        query = self.supabase.table('strip_led').select('*, lunghezza')
        query = query.eq('tensione', tensione).eq('ip', ip)
        
        if tipologia:
            query = query.eq('tipo', tipologia)
        
        strips = query.in_('id', strip_ids).execute().data
        
        if not strips:
            return []

        found_strip_ids = [s['id'] for s in strips]

        temperature_data = self.supabase.table('strip_temperature')\
            .select('strip_id, temperatura')\
            .in_('strip_id', found_strip_ids)\
            .execute().data

        potenze_data = self.supabase.table('strip_potenze')\
            .select('strip_id, potenza, codice_prodotto, indice')\
            .in_('strip_id', found_strip_ids)\
            .order('indice')\
            .execute().data

        temperature_map = {}
        for t in temperature_data:
            sid = t['strip_id']
            if sid not in temperature_map:
                temperature_map[sid] = []
            temperature_map[sid].append(t['temperatura'])
        
        potenze_map = {}
        codici_map = {}
        for p in potenze_data:
            sid = p['strip_id']
            if sid not in potenze_map:
                potenze_map[sid] = []
                codici_map[sid] = []
            potenze_map[sid].append(p['potenza'])
            codici_map[sid].append(p['codice_prodotto'])

        result = []
        for strip in strips:
            sid = strip['id']
            temp_list = temperature_map.get(sid, [])
            if temperatura not in temp_list:
                continue
            if potenza and potenza not in potenze_map.get(sid, []):
                continue

            strip['temperaturaColoreDisponibili'] = temp_list
            strip['temperatura'] = temperatura
            strip['potenzeDisponibili'] = potenze_map.get(sid, [])
            strip['codiciProdotto'] = codici_map.get(sid, [])
            strip['nomeCommerciale'] = strip.get('nome_commerciale', '')
            strip['taglioMinimo'] = strip.get('taglio_minimo', {})
            
            # ✅ NUOVO: Assicurare che lunghezzaMassima sia presente
            strip['lunghezzaMassima'] = strip.get('lunghezza', 5000)  # fallback a 5000mm
            
            result.append(strip)
        
        return result

    def get_all_strip_led_filtrate(self, tensione: str, ip: str, 
                                temperatura: str, potenza: Optional[str] = None,
                                tipologia: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Ottiene tutte le strip LED filtrate per i parametri specificati,
        senza considerare la compatibilità con un profilo specifico.
        Usato per il flusso esterni.
        """
        # ✅ MODIFICA: Includere la lunghezza nel select
        query = self.supabase.table('strip_led').select('*, lunghezza')
        query = query.eq('tensione', tensione).eq('ip', ip)
        
        if tipologia:
            query = query.eq('tipo', tipologia)
        
        strips = query.execute().data
        
        if not strips:
            return []

        found_strip_ids = [s['id'] for s in strips]

        temperature_data = self.supabase.table('strip_temperature')\
            .select('strip_id, temperatura')\
            .in_('strip_id', found_strip_ids)\
            .execute().data

        potenze_data = self.supabase.table('strip_potenze')\
            .select('strip_id, potenza, codice_prodotto, indice')\
            .in_('strip_id', found_strip_ids)\
            .order('indice')\
            .execute().data

        temperature_map = {}
        for t in temperature_data:
            sid = t['strip_id']
            if sid not in temperature_map:
                temperature_map[sid] = []
            temperature_map[sid].append(t['temperatura'])
        
        potenze_map = {}
        codici_map = {}
        for p in potenze_data:
            sid = p['strip_id']
            if sid not in potenze_map:
                potenze_map[sid] = []
                codici_map[sid] = []
            potenze_map[sid].append(p['potenza'])
            codici_map[sid].append(p['codice_prodotto'])

        result = []
        for strip in strips:
            sid = strip['id']
            temp_list = temperature_map.get(sid, [])
            if temperatura not in temp_list:
                continue
            if potenza and potenza not in potenze_map.get(sid, []):
                continue

            strip['temperaturaColoreDisponibili'] = temp_list
            strip['temperatura'] = temperatura
            strip['potenzeDisponibili'] = potenze_map.get(sid, [])
            strip['codiciProdotto'] = codici_map.get(sid, [])
            strip['nomeCommerciale'] = strip.get('nome_commerciale', '')
            strip['taglioMinimo'] = strip.get('taglio_minimo', {})
            
            # ✅ NUOVO: Assicurare che lunghezzaMassima sia presente
            strip['lunghezzaMassima'] = strip.get('lunghezza', 5000)  # fallback a 5000mm
            
            result.append(strip)
        
        return result

    def get_alimentatori_by_tipo(self, tipo_alimentazione: str, 
                                  tensione: str = '24V') -> List[Dict[str, Any]]:
        alimentatori_map = {
            'ON-OFF': ['SERIE_AT24', 'SERIE_ATUS', 'SERIE_ATSIP44', 
                       'SERIE_AT24IP67', 'SERIE_ATN24IP67'],
            'DIMMERABILE_TRIAC': ['SERIE_ATD24', 'SERIE_ATD24IP67']
        }
        
        if tensione == '48V':
            alimentatori_map['ON-OFF'] = ['SERIE_ATS48IP44']
        
        alimentatori_ids = alimentatori_map.get(tipo_alimentazione, [])
        
        if not alimentatori_ids:
            return []

        alimentatori = self.supabase.table('alimentatori')\
            .select('*')\
            .eq('tensione', tensione)\
            .in_('id', alimentatori_ids)\
            .execute().data
        
        if not alimentatori:
            return []

        alim_ids = [a['id'] for a in alimentatori]
        potenze_data = self.supabase.table('alimentatori_potenze')\
            .select('alimentatore_id, potenza, codice')\
            .in_('alimentatore_id', alim_ids)\
            .order('potenza')\
            .execute().data

        potenze_map = {}
        for p in potenze_data:
            aid = p['alimentatore_id']
            if aid not in potenze_map:
                potenze_map[aid] = []
            potenze_map[aid].append(p)

        for alim in alimentatori:
            aid = alim['id']
            potenze_list = potenze_map.get(aid, [])
            alim['potenze'] = [p['potenza'] for p in potenze_list]
            alim['codici'] = {str(p['potenza']): p['codice'] for p in potenze_list if p['codice']}
        
        return alimentatori
    
    def get_potenze_alimentatore(self, alimentatore_id: str) -> List[int]:
        cache_key = f"potenze_alim_{alimentatore_id}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        
        potenze = self.supabase.table('alimentatori_potenze')\
            .select('potenza')\
            .eq('alimentatore_id', alimentatore_id)\
            .order('potenza')\
            .execute().data
        
        result = [p['potenza'] for p in potenze]
        self._set_cache(cache_key, result)
        return result
    
    def get_dimmer_compatibili(self, strip_id: str) -> Dict[str, Any]:
        compatibilita = self.supabase.table('dimmer_strip_compatibili')\
            .select('dimmer_id')\
            .eq('strip_id', strip_id)\
            .execute().data
        
        dimmer_ids = [c['dimmer_id'] for c in compatibilita]
        
        if not dimmer_ids:
            return {
                'success': True,
                'opzioni': ['NESSUN_DIMMER'],
                'nomiDimmer': {'NESSUN_DIMMER': 'Nessun dimmer'},
                'codiciDimmer': {},
                'spaziNonIlluminati': {},
                'potenzeMassime': {}
            }

        dimmer_details = self.supabase.table('dimmer')\
            .select('*')\
            .in_('id', dimmer_ids)\
            .execute().data

        dimmer_ids.append('NESSUN_DIMMER')

        result = {
            'success': True,
            'opzioni': dimmer_ids,
            'nomiDimmer': {'NESSUN_DIMMER': 'Nessun dimmer'},
            'codiciDimmer': {},
            'spaziNonIlluminati': {},
            'potenzeMassime': {'NESSUN_DIMMER': 9999}
        }
        
        for dimmer in dimmer_details:
            result['nomiDimmer'][dimmer['id']] = dimmer['nome']
            if dimmer['codice']:
                result['codiciDimmer'][dimmer['id']] = dimmer['codice']
            if dimmer['spazio_non_illuminato']:
                result['spaziNonIlluminati'][dimmer['id']] = dimmer['spazio_non_illuminato']
            if dimmer['potenza_massima']:
                result['potenzeMassime'][dimmer['id']] = dimmer['potenza_massima']
        
        return result
    
    def salva_configurazione(self, configurazione: Dict[str, Any], 
                            codice_prodotto: str,
                            email: Optional[str] = None,
                            telefono: Optional[str] = None,
                            note: Optional[str] = None) -> Dict[str, Any]:
        data = {
            'codice_prodotto': codice_prodotto,
            'configurazione': configurazione,
            'email': email,
            'telefono': telefono,
            'note': note
        }
        
        result = self.supabase.table('configurazioni_salvate').insert(data).execute()
        
        return result.data[0] if result.data else None
    
    def get_dettagli_alimentatore(self, alimentatore_id: str) -> Dict[str, Any]:
        cache_key = f"dettagli_alim_{alimentatore_id}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        alimentatore = self.supabase.table('alimentatori')\
            .select('*')\
            .eq('id', alimentatore_id)\
            .single()\
            .execute().data
        
        if alimentatore:
            potenze_data = self.supabase.table('alimentatori_potenze')\
                .select('potenza, codice')\
                .eq('alimentatore_id', alimentatore_id)\
                .order('potenza')\
                .execute().data
            
            alimentatore['potenze'] = [p['potenza'] for p in potenze_data]
            alimentatore['codici'] = {str(p['potenza']): p['codice'] for p in potenze_data if p['codice']}
        
        self._set_cache(cache_key, alimentatore)
        return alimentatore
    
    def clear_cache(self):
        self._cache.clear()
        self._cache_timestamps.clear()
        logging.info("Cache cleared")
