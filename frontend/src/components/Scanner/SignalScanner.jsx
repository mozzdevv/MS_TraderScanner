import React, { useState, useEffect, useCallback, useRef } from 'react';
import ChartComponent from './ChartComponent';
import './SignalScanner.css';

const rand = (a,b) => Math.random()*(b-a)+a;
const fmtTime = (ms) => new Date(ms).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const fmtV = (v) => {
  if (!v || isNaN(v)) return '—';
  return v >= 1e9 ? (v/1e9).toFixed(1)+'B' : v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : String(v);
};
const rvCls = (r) => r >= 8 ? 'rv-hot' : r >= 4 ? 'rv-warm' : 'rv-ok';
const isOnFire = (d) => d.rvol >= 10 && d.chg >= 20 && d.momentum > 0.05 && d.aboveVwap && d.sess >= 3;

const COLS = [
  { key: 'signal', label: 'Signal · Sess', req: true },
  { key: 'sym', label: 'Symbol', req: true },
  { key: 'price', label: 'Price' },
  { key: 'chg', label: '% Chg' },
  { key: 'rvol', label: 'Rel.Vol' },
  { key: 'vol', label: 'Volume' },
  { key: 'range', label: 'Day Range' },
  { key: 'momentum', label: 'Momentum' },
  { key: 'news', label: 'News' },
  { key: 'time', label: 'Last Updated' },
];

const tCls = { 'Session High': 't-hi', 'Price Spike': 't-sp', 'VWAP Cross': 't-vw' };

export default function SignalScanner() {
  const [ALL, setALL] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [marketStatus, setMarketStatus] = useState('Waiting for connection...');
  const [isLive, setIsLive] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);
  
  const [filterState, setFilterState] = useState({ pMin: 0.30, pMax: 5.00, rMin: 3.0 });
  const [visibleCols, setVisibleCols] = useState({
    signal: true, sym: true, price: true, chg: true, rvol: true, vol: true, range: true, momentum: false, news: false, time: true
  });

  const stateRef = useRef({ ALL: [], candleHistory: {} });
  const polyApiKey = process.env.NEXT_PUBLIC_POLYGON_API_KEY || '';

  const getTop3 = useCallback(() => {
    return [...stateRef.current.ALL].filter(d => d.sess > 0).sort((a,b) => b.chg - a.chg).slice(0,3);
  }, []);

  const fetchCandlesForTop3 = useCallback(async (top3) => {
    if (!polyApiKey) return;
    const now = new Date();
    const to = Math.floor(now.getTime() / 1000);
    const from = Math.floor((now.getTime() - 3600000) / 1000); // last hour

    for (const d of top3) {
      try {
        const url = `https://api.polygon.io/v2/aggs/ticker/${d.sym}/range/5/minute/${from}/${to}?adjusted=true&sort=asc&limit=12&apiKey=${polyApiKey}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.results && json.results.length) {
          const candles = json.results.map(r => ({
            time: Math.floor(r.t/1000), open: r.o, high: r.h, low: r.l, close: r.c, vol: r.v
          }));
          stateRef.current.candleHistory[d.sym] = candles;
          setALL([...stateRef.current.ALL]);
        }
      } catch (e) { console.warn('Candle fetch failed for', d.sym, e); }
    }
  }, [polyApiKey]);

  const fetchAndRefresh = useCallback(async () => {
    if (!polyApiKey) return;
    try {
      const [gainersRes, loosersRes] = await Promise.all([
        fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${polyApiKey}`),
        fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/losers?apiKey=${polyApiKey}`)
      ]);
      const gainersData = await gainersRes.json();
      const loosersData = await loosersRes.json();
      
      const tickers = [...(gainersData.tickers || []), ...(loosersData.tickers || [])];
      if (!tickers.length) return;

      const candidates = tickers.filter(t => {
        const price = t.day?.c || t.lastTrade?.p || 0;
        const chg = t.todaysChangePerc || 0;
        const vol = t.day?.v || 0;
        const avgVol = t.prevDay?.v || 1;
        const rvol = avgVol > 0 ? vol / avgVol : 0;
        return price >= 0.30 && price <= 5.00 && vol > avgVol && rvol >= 3 && Math.abs(chg) >= 10;
      });

      const top25 = candidates.slice(0, 25);
      const now = Date.now();
      const currentAll = stateRef.current.ALL;

      const newStocks = top25.map(t => {
        const sym = t.ticker;
        const price = +(t.day?.c || t.lastTrade?.p || 0).toFixed(4);
        const high = t.day?.h || price;
        const low = t.day?.l || price;
        const vol = t.day?.v || 0;
        const prevVol = t.prevDay?.v || 1;
        const rvol = +Math.min(prevVol > 0 ? vol / prevVol : 0, 999.9).toFixed(1);
        const chg = +(t.todaysChangePerc || 0).toFixed(2);
        const vwap = +(t.day?.vw || price).toFixed(4);
        const aboveVwap = price > vwap;

        const existing = currentAll.find(d => d.sym === sym);
        const priceHistory = existing ? [...existing.priceHistory, price].slice(-24) : [price];
        const momentum = priceHistory.length > 1 ? +(priceHistory[priceHistory.length-1] - priceHistory[0]).toFixed(4) : 0;

        let signal = existing?.signal || 'Session High';
        let sess = existing ? existing.sess : 0;
        
        const isNewHigh = price >= high && (!existing || price > existing.dayHigh);
        if (isNewHigh) {
          sess = existing ? existing.sess + 1 : 1;
          signal = 'Session High';
        }

        const minRecent = priceHistory.length > 1 ? Math.min(...priceHistory) : price;
        if (minRecent > 0 && ((price - minRecent) / minRecent) >= 0.10) {
          signal = 'Price Spike';
        } else if (!existing && chg >= 10) {
          signal = 'Price Spike';
        }
        if (aboveVwap && existing && existing.price <= existing.vwap) signal = 'VWAP Cross';

        const quote = t.lastQuote || {};
        const spread = (quote.P && quote.p) ? +(quote.P - quote.p).toFixed(4) : 0;
        const isFresh = !existing || Math.abs(price - existing.price) > 0.001;

        return {
          sym, price, chg, rvol, float: existing?.float || +(rand(5, 49.9)).toFixed(1),
          vol, avgVol: prevVol, signal, sess: Math.max(1, sess),
          vwap, aboveVwap, dayHigh: +high.toFixed(4), dayLow: +low.toFixed(4),
          momentum, priceHistory, spread, news: false, cat: existing?.cat || '', halt: false,
          lastUpdatedMs: now, lastUpdatedStr: fmtTime(now), ts: now, isFresh, prevPrice: existing?.price || price
        };
      });

      const staleThreshold = 30000;
      const kept = currentAll.filter(d => !newStocks.find(n => n.sym === d.sym) && (now - d.lastUpdatedMs) < staleThreshold)
                             .map(d => ({ ...d, isFresh: false }));
      
      const prevTopRow = currentAll.length ? currentAll[0].sym : null;
      let merged = [...newStocks, ...kept].sort((a, b) => b.lastUpdatedMs - a.lastUpdatedMs);
      const newTopRow = merged.length ? merged[0].sym : null;
      
      if (newTopRow && newTopRow !== prevTopRow) {
         merged[0].pulseBlue = true;
      }

      stateRef.current.ALL = merged;
      setALL(merged);
      
      fetchCandlesForTop3(merged.filter(d => d.sess > 0).sort((a,b) => b.chg - a.chg).slice(0,3));
    } catch (err) { console.error('Polygon fetch error:', err); }
  }, [polyApiKey, fetchCandlesForTop3]);

  useEffect(() => {
    if (!polyApiKey) { setMarketStatus('Key Required: Ensure NEXT_PUBLIC_POLYGON_API_KEY is in .env.local'); return; }
    
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', {timeZone: 'America/New_York'}));
    const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
    const marketOpen = day >= 1 && day <= 5 && (h > 9 || (h === 9 && m >= 30)) && h < 16;
    const afterHours = day >= 1 && day <= 5 && ((h >= 16 && h < 20) || (h < 9 || (h === 9 && m < 30)));
    
    setIsConnected(true);
    if (marketOpen) { setIsLive(true); setMarketStatus('● Real-time'); }
    else if (afterHours) { setIsLive(false); setMarketStatus('◑ After Hours'); }
    else { setIsLive(false); setMarketStatus('○ Market Closed'); }

    fetchAndRefresh();
    const interval = setInterval(fetchAndRefresh, 5000);
    return () => clearInterval(interval);
  }, [polyApiKey, fetchAndRefresh]);

  const applyFilters = () => {
    setFilterState({
      pMin: parseFloat(document.getElementById('fMin').value) || 0,
      pMax: parseFloat(document.getElementById('fMax').value) || 999,
      rMin: parseFloat(document.getElementById('fRv').value) || 0,
    });
    setIsDrawerOpen(false);
  };

  const passesFilter = (d) => !!(d.price >= filterState.pMin && d.price <= filterState.pMax && d.rvol >= filterState.rMin);
  const activeCols = COLS.filter(c => visibleCols[c.key] !== false || c.req);

  return (
    <div id="shell" className={isDark ? 'dark' : ''} style={{width:'100%', height:'100%'}}>
      <div className="main">
        <div className="topnav">
          <div className="nav-left">
            <div>
              <div className="nav-title">Signal Scanner</div>
              <div className="nav-sub">Real-time · ordered by last update</div>
            </div>
          </div>
          <div className="nav-right">
            <div className={`data-mode ${isLive ? 'mode-live' : 'mode-delayed'}`}>{marketStatus}</div>
            <button className="mode-btn" onClick={() => setIsDark(!isDark)}>
              <span id="modeLbl">{isDark ? 'Light mode' : 'Dark mode'}</span>
            </button>
          </div>
        </div>

        <div className="content">
          <div className="controls">
            <div className="ctrl-pills">
              <button className={`filter-btn ${isDrawerOpen?'open':''}`} onClick={() => setIsDrawerOpen(!isDrawerOpen)}>
                Filters
              </button>
              <span className="cpill on">${filterState.pMin}–${filterState.pMax}</span>
              <span className="cpill on">RVol ≥{filterState.rMin}x</span>
            </div>
            <div style={{ position: 'relative' }}>
              <button className={`ctrl-btn ${isColMenuOpen?'active':''}`} onClick={() => setIsColMenuOpen(!isColMenuOpen)}>
                Columns
              </button>
              {isColMenuOpen && (
                <div className="col-menu" style={{display:'block'}}>
                  <div className="cm-title">Show / hide columns</div>
                  {COLS.map(c => (
                    <div key={c.key} className="ci" onClick={() => !c.req && setVisibleCols(prev => ({...prev, [c.key]: !prev[c.key]}))}>
                      <div className={`ccb ${visibleCols[c.key] !== false || c.req ? 'on' : ''}`}></div>
                      <span className="cn">{c.label}{c.req?' *':''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="exp-btn">Export CSV</button>
          </div>

          {isDrawerOpen && (
            <div className="filter-drawer open">
               <div className="fd-row">
                 <div className="fg"><div className="fl">Price min</div><input className="fi" id="fMin" type="number" defaultValue={filterState.pMin} step="0.05" /></div>
                 <div className="fg"><div className="fl">Price max</div><input className="fi" id="fMax" type="number" defaultValue={filterState.pMax} step="0.25" /></div>
                 <div className="fg"><div className="fl">Min rel.vol</div><input className="fi" id="fRv" type="number" defaultValue={filterState.rMin} step="0.5" /></div>
                 <button className="apply-btn" onClick={applyFilters}>Apply</button>
               </div>
            </div>
          )}

          <div className="top3">
            {getTop3().map(d => (
              <div key={d.sym} className="tc">
                <div className="tc-bar"></div>
                <div className="tc-head">
                  <div className="tc-left">
                    <div className="tc-sym">{d.sym}</div>
                    <div className="tc-price">${d.price.toFixed(2)}</div>
                    <div className="tc-cat">VWAP ${d.vwap.toFixed(2)} <span className={d.aboveVwap?'vu':'vd'}>({d.aboveVwap?'+':''}{((d.price-d.vwap)/d.vwap*100).toFixed(1)}%)</span></div>
                  </div>
                  <div className="tc-meta">
                    <div className="tc-sess">{d.sess}</div>
                    <div className="tc-slbl">session highs</div>
                    <div className={`tc-chg ${d.chg<0?'vd':''}`}>{d.chg>=0?'+':''}{d.chg.toFixed(1)}%</div>
                  </div>
                </div>
                <ChartComponent ticker={d.sym} isDark={isDark} candles={stateRef.current.candleHistory[d.sym]} />
                <div className="tc-stats">
                  <div className="tc-stat"><div className="ts-l">Rel.Vol</div><div className="ts-v c-a">{d.rvol.toFixed(1)}x</div></div>
                  <div className="tc-stat"><div className="ts-l">Volume</div><div className="ts-v c-g">{fmtV(d.vol)}</div></div>
                  <div className="tc-stat"><div className="ts-l">Day High</div><div className="ts-v" style={{color:'var(--green)'}}>${d.dayHigh.toFixed(2)}</div></div>
                  <div className="tc-stat"><div className="ts-l">Day Low</div><div className="ts-v" style={{color:'var(--red)'}}>${d.dayLow.toFixed(2)}</div></div>
                  <div className="tc-stat"><div className="ts-l">Avg Vol</div><div className="ts-v c-b">{fmtV(d.avgVol)}</div></div>
                  <div className="tc-stat"><div className="ts-l">Spread</div><div className="ts-v c-t">${d.spread.toFixed(3)}</div></div>
                  <div className="tc-stat"><div className="ts-l">Momentum</div><div className={`ts-v mom ${d.momentum>=0?'mom-up':'mom-dn'}`}>{d.momentum>=0?'▲':'▼'} {Math.abs(d.momentum).toFixed(3)}</div></div>
                  <div className="tc-stat"><div className="ts-l">Signal</div><div className="ts-v" style={{fontSize:10}}>{d.signal}</div></div>
                </div>
              </div>
            ))}
          </div>

          <div className="tbl-card">
            <div className="tbl-nav">
              <div className="tbl-title">{new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
              <div className="tbl-right">
                <div className="scan-status"><div className={`scan-dot ${isConnected?'live':''}`}></div><span>{isConnected ? 'Scanning every 5s' : 'Waiting for connection...'}</span></div>
                <span className="tbl-cnt">{ALL.filter(passesFilter).length} signals</span>
              </div>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>{activeCols.map(c => <th key={c.key}>{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {ALL.filter(passesFilter).map(d => {
                    const vd = ((d.price - d.vwap) / d.vwap * 100).toFixed(1);
                    const fire = isOnFire(d);
                    const pct = Math.max(0, Math.min(100, ((d.price - d.dayLow) / ((d.dayHigh - d.dayLow) || 0.01)) * 100)).toFixed(0);
                    
                    let flashClass = '';
                    if (d.pulseBlue) flashClass = 'row-fresh';
                    else if (d.isFresh) {
                      if (d.price > d.prevPrice) flashClass = 'flash-g';
                      else if (d.price < d.prevPrice) flashClass = 'flash-r';
                    }

                    return (
                      <tr key={d.sym} className={`${fire ? 'fire-r' : ''} ${flashClass}`}>
                        {activeCols.find(c=>c.key==='signal') && <td><div className="sig-cell"><span className={`tag ${tCls[d.signal]||'t-hi'}`}>{d.signal}</span><span className="sess-n">{d.sess}</span>{fire&&<span className="fem">🔥</span>}</div></td>}
                        {activeCols.find(c=>c.key==='sym') && <td><div className="sym-main">{d.sym}</div><div className="sym-cat">{d.cat}{d.halt&&<span className="htag">HALT</span>}</div></td>}
                        {activeCols.find(c=>c.key==='price') && <td><div className="pm">${d.price.toFixed(2)}</div><div className={`pv ${d.aboveVwap?'vu':'vd'}`}>{d.aboveVwap?'+':''}{vd}% VWAP</div></td>}
                        {activeCols.find(c=>c.key==='chg') && <td><span className={`cup ${d.chg<0?'neg':''}`}>{d.chg>=0?'+':''}{d.chg.toFixed(1)}%</span></td>}
                        {activeCols.find(c=>c.key==='rvol') && <td><span className={`rvp ${rvCls(d.rvol)}`}>{d.rvol.toFixed(1)}x</span></td>}
                        {activeCols.find(c=>c.key==='vol') && <td><div className="vm">{fmtV(d.vol)}</div><div className="va">{fmtV(d.avgVol)} avg</div></td>}
                        {activeCols.find(c=>c.key==='range') && <td><div className="range-cell"><span className="range-h">H ${d.dayHigh.toFixed(2)}</span><div className="range-bar-wrap"><div className="range-bar" style={{left:`${pct}%`}}></div></div><span className="range-l">L ${d.dayLow.toFixed(2)}</span></div></td>}
                        {activeCols.find(c=>c.key==='momentum') && <td><span className={`mom ${d.momentum>0?'mom-up':d.momentum<0?'mom-dn':'mom-flat'}`}>{d.momentum>=0?'▲':'▼'} {Math.abs(d.momentum).toFixed(3)}</span></td>}
                        {activeCols.find(c=>c.key==='news') && <td><span style={{color:'var(--faint)'}}>—</span></td>}
                        {activeCols.find(c=>c.key==='time') && <td><span className="tv">{d.lastUpdatedStr}</span></td>}
                      </tr>
                    );
                  })}
                  {ALL.filter(passesFilter).length === 0 && (
                     <tr><td colSpan="20"><div className="empty-state"><div className="empty-title">No signals yet</div><div className="empty-sub">{polyApiKey ? 'No stocks match filters.' : 'Ensure API Key is set.'}</div></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
