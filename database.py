# database.py
from supabase import create_client, Client
import os
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
import logging
from functools import lru_cache
from datetime import datetime, timedelta

# Carica le variabili d'ambiente dal file .env
load_dotenv()

class DatabaseManager:
    def __init__(self):
        self.supabase: Client = create_client(
            os.environ.get('SUPABASE_URL'),
            os.environ.get('SUPABASE_KEY')
        )
        # Cache semplice per evitare query ripetute
        self._cache = {}
        self._cache_timestamps = {}
        self._cache_duration = timedelta(minutes=30)
    
    def _get_from_cache(self, key: str) -> Optional[Any]:
        """Ottiene un valore dalla cache se non è scaduto"""
        if key in self._cache:
            if datetime.now() - self._cache_timestamps[key] < self._cache_duration:
                return self._cache[key]
            else:
                del self._cache[key]
                del self._cache_timestamps[key]
        return None
    
    def _set_cache(self, key: str, value: Any):
        """Salva un valore nella cache"""
        self._cache[key] = value
        self._cache_timestamps[key] = datetime.now()
    
    def get_categorie(self) -> List[Dict[str, Any]]:
        """Ottiene tutte le categorie con le loro sottofamiglie - OTTIMIZZATO"""
        cache_key = "all_categorie"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        
        # 1. Prendi tutte le categorie
        categorie = self.supabase.table('categorie').select('*').execute().data
        
        # 2. Prendi TUTTE le sottofamiglie in una sola query
        sottofamiglie_data = self.supabase.table('categorie_sottofamiglie')\
            .select('categoria_id, sottofamiglia')\
            .execute().data
        
        # 3. Crea una mappa per accesso rapido
        sottofamiglie_map = {}
        for sf in sottofamiglie_data:
            cat_id = sf['categoria_id']
            if cat_id not in sottofamiglie_map:
                sottofamiglie_map[cat_id] = []
            sottofamiglie_map[cat_id].append(sf['sottofamiglia'])
        
        # 4. Associa le sottofamiglie alle categorie
        for categoria in categorie:
            categoria['sottofamiglie'] = sottofamiglie_map.get(categoria['id'], [])
        
        self._set_cache(cache_key, categorie)
        return categorie
    
    def get_profili_by_categoria(self, categoria: str) -> List[Dict[str, Any]]:
        """Ottiene i profili di una categoria specifica - OTTIMIZZATO"""
        cache_key = f"profili_categoria_{categoria}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        
        # 1. Prendi tutti i profili della categoria
        profili = self.supabase.table('profili')\
            .select('*')\
            .eq('categoria', categoria)\
            .execute().data
        
        if not profili:
            return []
        
        # 2. Estrai tutti gli ID dei profili
        profili_ids = [p['id'] for p in profili]
        
        # 3. Fai query batch per tutti i dati correlati
        # Tipologie
        tipologie_data = self.supabase.table('profili_tipologie')\
            .select('profilo_id, tipologia')\
            .in_('profilo_id', profili_ids)\
            .execute().data
        
        # Finiture
        finiture_data = self.supabase.table('profili_finiture')\
            .select('profilo_id, finitura')\
            .in_('profilo_id', profili_ids)\
            .execute().data
        
        # Lunghezze
        lunghezze_data = self.supabase.table('profili_lunghezze')\
            .select('profilo_id, lunghezza')\
            .in_('profilo_id', profili_ids)\
            .order('lunghezza')\
            .execute().data
        
        # Strip compatibili
        strip_compatibili_data = self.supabase.table('profili_strip_compatibili')\
            .select('profilo_id, strip_id')\
            .in_('profilo_id', profili_ids)\
            .execute().data
        
        # 4. Crea mappe per accesso rapido
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
        
        # 5. Associa i dati ai profili
        for profilo in profili:
            pid = profilo['id']
            profilo['tipologie'] = tipologie_map.get(pid, [])
            profilo['finitureDisponibili'] = finiture_map.get(pid, [])
            profilo['lunghezzeDisponibili'] = lunghezze_map.get(pid, [])
            profilo['stripLedCompatibili'] = strip_map.get(pid, [])
            profilo['lunghezzaMassima'] = profilo.get('lunghezza_massima', 3000)
        
        self._set_cache(cache_key, profili)
        return profili
    
    def get_strip_led_filtrate(self, profilo_id: str, tensione: str, ip: str, 
                               temperatura: str, potenza: Optional[str] = None,
                               tipologia: Optional[str] = None) -> List[Dict[str, Any]]:
        """Ottiene le strip LED filtrate per i parametri specificati - OTTIMIZZATO"""
        # 1. Ottieni le strip compatibili con il profilo
        strip_compatibili = self.supabase.table('profili_strip_compatibili')\
            .select('strip_id')\
            .eq('profilo_id', profilo_id)\
            .execute().data
        
        strip_ids = [s['strip_id'] for s in strip_compatibili]
        
        if not strip_ids:
            return []
        
        # 2. Query base per le strip
        query = self.supabase.table('strip_led').select('*')
        query = query.eq('tensione', tensione).eq('ip', ip)
        
        if tipologia:
            query = query.eq('tipo', tipologia)
        
        strips = query.in_('id', strip_ids).execute().data
        
        if not strips:
            return []
        
        # 3. Estrai gli ID delle strip trovate
        found_strip_ids = [s['id'] for s in strips]
        
        # 4. Fai query batch per temperature e potenze
        # Temperature
        temperature_data = self.supabase.table('strip_temperature')\
            .select('strip_id, temperatura')\
            .in_('strip_id', found_strip_ids)\
            .execute().data
        
        # Potenze
        potenze_data = self.supabase.table('strip_potenze')\
            .select('strip_id, potenza, codice_prodotto, indice')\
            .in_('strip_id', found_strip_ids)\
            .order('indice')\
            .execute().data
        
        # 5. Crea mappe per accesso rapido
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
        
        # 6. Filtra e assembla il risultato
        result = []
        for strip in strips:
            sid = strip['id']
            
            # Verifica temperatura
            temp_list = temperature_map.get(sid, [])
            if temperatura not in temp_list:
                continue
            
            # Se specificata potenza, verifica
            if potenza and potenza not in potenze_map.get(sid, []):
                continue
            
            # Aggiungi info alla strip
            strip['temperaturaColoreDisponibili'] = temp_list
            strip['temperatura'] = temperatura
            strip['potenzeDisponibili'] = potenze_map.get(sid, [])
            strip['codiciProdotto'] = codici_map.get(sid, [])
            strip['nomeCommerciale'] = strip.get('nome_commerciale', '')
            strip['taglioMinimo'] = strip.get('taglio_minimo', {})
            
            result.append(strip)
        
        return result
    
    def get_alimentatori_by_tipo(self, tipo_alimentazione: str, 
                                  tensione: str = '24V') -> List[Dict[str, Any]]:
        """Ottiene gli alimentatori per tipo e tensione - OTTIMIZZATO"""
        # Mappa i tipi di alimentazione agli ID degli alimentatori
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
        
        # 1. Query per gli alimentatori
        alimentatori = self.supabase.table('alimentatori')\
            .select('*')\
            .eq('tensione', tensione)\
            .in_('id', alimentatori_ids)\
            .execute().data
        
        if not alimentatori:
            return []
        
        # 2. Query batch per tutte le potenze
        alim_ids = [a['id'] for a in alimentatori]
        potenze_data = self.supabase.table('alimentatori_potenze')\
            .select('alimentatore_id, potenza, codice')\
            .in_('alimentatore_id', alim_ids)\
            .order('potenza')\
            .execute().data
        
        # 3. Crea mappa per accesso rapido
        potenze_map = {}
        for p in potenze_data:
            aid = p['alimentatore_id']
            if aid not in potenze_map:
                potenze_map[aid] = []
            potenze_map[aid].append(p)
        
        # 4. Associa le potenze agli alimentatori
        for alim in alimentatori:
            aid = alim['id']
            potenze_list = potenze_map.get(aid, [])
            alim['potenze'] = [p['potenza'] for p in potenze_list]
            alim['codici'] = {str(p['potenza']): p['codice'] for p in potenze_list if p['codice']}
        
        return alimentatori
    
    def get_potenze_alimentatore(self, alimentatore_id: str) -> List[int]:
        """Ottiene le potenze disponibili per un alimentatore"""
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
        """Ottiene i dimmer compatibili con una strip LED - OTTIMIZZATO"""
        # 1. Ottieni i dimmer compatibili
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
        
        # 2. Ottieni i dettagli dei dimmer in una sola query
        dimmer_details = self.supabase.table('dimmer')\
            .select('*')\
            .in_('id', dimmer_ids)\
            .execute().data
        
        # 3. Aggiungi sempre l'opzione NESSUN_DIMMER
        dimmer_ids.append('NESSUN_DIMMER')
        
        # 4. Costruisci la risposta
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
        """Salva una configurazione completata"""
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
        """Ottiene i dettagli di un alimentatore specifico - OTTIMIZZATO"""
        cache_key = f"dettagli_alim_{alimentatore_id}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached
        
        # Prendi l'alimentatore
        alimentatore = self.supabase.table('alimentatori')\
            .select('*')\
            .eq('id', alimentatore_id)\
            .single()\
            .execute().data
        
        if alimentatore:
            # Prendi le potenze
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
        """Pulisce la cache"""
        self._cache.clear()
        self._cache_timestamps.clear()
        logging.info("Cache cleared")