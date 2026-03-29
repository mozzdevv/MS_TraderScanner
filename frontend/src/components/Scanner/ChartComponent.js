import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

export default function ChartComponent({ ticker, isDark, candles }) {
  const chartContainerRef = useRef();
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  
  const c = {
    bg: isDark ? '#111827' : '#ffffff',
    grid: isDark ? 'rgba(30,41,59,0.7)' : 'rgba(226,230,237,0.9)',
    text: isDark ? '#475569' : '#94a3b8',
    border: isDark ? '#1e293b' : '#e2e6ed',
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth || 280,
      height: 150,
      layout: { background: { type: 'solid', color: c.bg }, textColor: c.text, fontSize: 10, fontFamily: '-apple-system,Inter,sans-serif' },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: c.border, textColor: c.text, scaleMargins: { top: 0.06, bottom: 0.25 } },
      timeScale: { borderColor: c.border, visible: true, timeVisible: true, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true },
    });
    
    const cs = chart.addCandlestickSeries({ upColor: '#0ea371', downColor: '#e8394a', wickUpColor: '#0ea371', wickDownColor: '#e8394a', borderVisible: false });
    const vs = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.78, bottom: 0 }, borderVisible: false });

    chartRef.current = chart;
    seriesRef.current = { cs, vs };

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.resize(chartContainerRef.current.clientWidth, 150);
      }
    };
    
    // ResizeObserver doesn't cleanly clean up inside useEffect in old Safari, but usually okay
    const ro = new ResizeObserver(handleResize);
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [isDark]); // Re-create on dark mode toggle

  useEffect(() => {
    if (seriesRef.current && candles?.length) {
      const { cs, vs } = seriesRef.current;
      cs.setData(candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
      vs.setData(candles.map(c => ({ time: c.time, value: c.vol, color: c.close >= c.open ? 'rgba(14,163,113,0.28)' : 'rgba(232,57,74,0.26)' })));
      if (chartRef.current) chartRef.current.timeScale().fitContent();
    }
  }, [candles]);

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '150px', position: 'relative' }}>
        <div style={{position: 'absolute', top: 4, right: 6, fontSize: 9, color: 'var(--faint, #94a3b8)', pointerEvents: 'none', zIndex: 2}}>
            Scroll to zoom · Drag to pan
        </div>
    </div>
  );
}
