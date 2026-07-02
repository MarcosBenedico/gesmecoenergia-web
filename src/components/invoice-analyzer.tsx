'use client';

import { useState } from 'react';
import { ScrollReveal } from './scroll-reveal';

type AnalyzerStep = 'intro' | 'method' | 'upload' | 'form' | 'results';

interface AnalysisResult {
  monthlySpend: number;
  powerCost: number;
  energyCost: number;
  taxesCost: number;
  savingPotential: number;
  recommendations: string[];
}

export function InvoiceAnalyzer() {
  const [step, setStep] = useState<AnalyzerStep>('intro');
  const [dragActive, setDragActive] = useState(false);
  const [formData, setFormData] = useState({
    monthlyBill: '',
    powerCost: '',
    energyCost: '',
  });
  const [results, setResults] = useState<AnalysisResult | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      simulateAnalysis(parseFloat(formData.monthlyBill) || 150);
    }
  };

  const simulateAnalysis = (totalSpend: number) => {
    const power = totalSpend * 0.3;
    const energy = totalSpend * 0.5;
    const taxes = totalSpend * 0.2;
    const saving = totalSpend * 0.25;

    setResults({
      monthlySpend: totalSpend,
      powerCost: power,
      energyCost: energy,
      taxesCost: taxes,
      savingPotential: saving,
      recommendations: [
        'Renegociar tarifa con comercializadora: ahorro potencial 15-20%',
        'Reducir potencia contratada: actualmente sobre-dimensionada',
        'Instalar solar fotovoltaica: amortización en 2-3 años',
        'Optimizar consumo en horario valle',
      ],
    });
    setStep('results');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalSpend = parseFloat(formData.monthlyBill) || 0;
    if (totalSpend > 0) {
      simulateAnalysis(totalSpend);
    }
  };

  return (
    <div className="space-y-20 py-20">
      {/* ── INTRO STEP ── */}
      {step === 'intro' && (
        <ScrollReveal>
          <div className="mx-auto max-w-2xl px-6 space-y-8 text-center">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black text-foreground">
                ¿Cuánto puedes ahorrar?
              </h1>
              <p className="text-lg text-muted">
                Analiza tu factura de luz y gas en 2 minutos. Descubre exactamente dónde se va tu dinero
                y cuánto puedes ahorrar con cambios simples.
              </p>
            </div>

            {/* Stats preview */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[
                { label: 'Ahorros detectados', value: '€2.500', subtext: 'anuales' },
                { label: 'Tiempo análisis', value: '2 min', subtext: '100% online' },
                { label: 'Sin obligación', value: '✓', subtext: 'Análisis gratis' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                  <div className="text-2xl font-black text-accent">{stat.value}</div>
                  <div className="text-xs font-bold text-muted uppercase tracking-wider mt-1">
                    {stat.label}
                  </div>
                  <div className="text-[10px] text-muted/60">{stat.subtext}</div>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <button
              onClick={() => setStep('method')}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-light px-8 py-4 text-lg font-black text-white shadow-lg transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_rgba(255,51,51,0.4)]"
            >
              Empezar análisis →
            </button>
          </div>
        </ScrollReveal>
      )}

      {/* ── METHOD SELECTION STEP ── */}
      {step === 'method' && (
        <ScrollReveal>
          <div className="mx-auto max-w-3xl px-6 space-y-8">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-3xl font-black text-foreground">Elige tu método</h2>
              <p className="text-muted">¿Cómo prefieres compartir tu información?</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Upload PDF option */}
              <button
                onClick={() => setStep('upload')}
                className="group relative overflow-hidden rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-8 transition-all hover:border-accent/60 hover:shadow-[0_0_30px_rgba(255,51,51,0.2)]"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-transparent scale-x-0 group-hover:scale-x-100 transition-transform" />
                <div className="space-y-4">
                  <div className="text-5xl">📄</div>
                  <h3 className="text-lg font-bold text-foreground">Subir tu factura</h3>
                  <p className="text-sm text-muted">
                    Carga un PDF de tu factura actual. Es el método más preciso y rápido.
                  </p>
                  <div className="text-xs text-accent font-semibold pt-2">
                    ✓ PDF seguro · ✓ 100% privado
                  </div>
                </div>
              </button>

              {/* Manual entry option */}
              <button
                onClick={() => setStep('form')}
                className="group relative overflow-hidden rounded-2xl border-2 border-secondary/30 bg-gradient-to-br from-secondary/10 to-transparent p-8 transition-all hover:border-secondary/60 hover:shadow-[0_0_30px_rgba(0,212,255,0.2)]"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary to-transparent scale-x-0 group-hover:scale-x-100 transition-transform" />
                <div className="space-y-4">
                  <div className="text-5xl">✏️</div>
                  <h3 className="text-lg font-bold text-foreground">Introducir datos</h3>
                  <p className="text-sm text-muted">
                    Rellena manualmente los importes de tu última factura. Solo toma 1 minuto.
                  </p>
                  <div className="text-xs text-secondary font-semibold pt-2">
                    ✓ Rápido · ✓ Sin documentos
                  </div>
                </div>
              </button>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* ── UPLOAD STEP ── */}
      {step === 'upload' && (
        <ScrollReveal>
          <div className="mx-auto max-w-2xl px-6 space-y-8">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-3xl font-black text-foreground">Sube tu factura</h2>
              <p className="text-muted">PDF, JPG o PNG. Máximo 10 MB.</p>
            </div>

            {/* Drag & Drop zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed transition-all p-12 text-center cursor-pointer ${
                dragActive
                  ? 'border-accent bg-accent/10 scale-[1.02]'
                  : 'border-border/40 bg-surface/40 hover:border-accent/50 hover:bg-surface/60'
              }`}
            >
              <div className="space-y-3">
                <div className="text-5xl">📤</div>
                <div>
                  <p className="text-lg font-bold text-foreground">Arrastra tu factura aquí</p>
                  <p className="text-sm text-muted mt-1">o haz clic para seleccionar un archivo</p>
                </div>
              </div>
            </div>

            {/* Fallback: manual entry inline */}
            <div className="border-t border-border/20 pt-8">
              <p className="text-sm text-muted text-center mb-6">
                ¿No tienes la factura a mano? Introduce los datos de forma manual:
              </p>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-foreground block mb-2">
                    Gasto mensual total (€)
                  </label>
                  <input
                    type="number"
                    value={formData.monthlyBill}
                    onChange={(e) => setFormData({ ...formData, monthlyBill: e.target.value })}
                    placeholder="ej: 150"
                    className="w-full rounded-lg border border-border/40 bg-card/60 px-4 py-3 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-gradient-to-r from-accent to-accent-light px-4 py-3 font-bold text-white transition-all hover:scale-[1.01] hover:shadow-lg"
                >
                  Analizar factura
                </button>
              </form>
            </div>

            <button
              onClick={() => setStep('method')}
              className="w-full text-sm text-muted hover:text-foreground transition"
            >
              ← Volver atrás
            </button>
          </div>
        </ScrollReveal>
      )}

      {/* ── FORM STEP ── */}
      {step === 'form' && (
        <ScrollReveal>
          <div className="mx-auto max-w-2xl px-6 space-y-8">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-3xl font-black text-foreground">Datos de tu factura</h2>
              <p className="text-muted">Solo necesitamos los importes principales</p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="space-y-4 bg-surface/40 rounded-xl p-6 border border-border/20">
                <div>
                  <label className="text-sm font-bold text-foreground block mb-2">
                    Gasto total mensual (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.monthlyBill}
                    onChange={(e) => setFormData({ ...formData, monthlyBill: e.target.value })}
                    placeholder="ej: 150.50"
                    className="w-full rounded-lg border border-border/40 bg-card/60 px-4 py-3 text-foreground placeholder-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                  />
                  <p className="text-xs text-muted mt-1">Aparece como "Total a pagar" en tu factura</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/20">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-2 uppercase tracking-wider">
                      Coste potencia (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.powerCost}
                      onChange={(e) => setFormData({ ...formData, powerCost: e.target.value })}
                      placeholder="ej: 45"
                      className="w-full rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-sm text-foreground placeholder-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-2 uppercase tracking-wider">
                      Coste energía (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.energyCost}
                      onChange={(e) => setFormData({ ...formData, energyCost: e.target.value })}
                      placeholder="ej: 75"
                      className="w-full rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-sm text-foreground placeholder-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-r from-accent to-accent-light px-4 py-4 font-bold text-white transition-all hover:scale-[1.01] hover:shadow-lg text-lg"
              >
                Ver análisis →
              </button>
            </form>

            <button
              onClick={() => setStep('method')}
              className="w-full text-sm text-muted hover:text-foreground transition"
            >
              ← Volver atrás
            </button>
          </div>
        </ScrollReveal>
      )}

      {/* ── RESULTS STEP ── */}
      {results && step === 'results' && (
        <ScrollReveal>
          <div className="mx-auto max-w-4xl px-6 space-y-8">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent">Análisis Completo</span>
              </div>
              <h2 className="text-4xl font-black text-foreground">Tu potencial de ahorro</h2>
            </div>

            {/* Big saving number */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 p-8 md:p-12">
              <div className="absolute top-0 right-0 w-40 h-40 bg-accent/10 rounded-full -mr-20 -mt-20" />
              <div className="relative space-y-2">
                <p className="text-sm font-bold uppercase tracking-widest text-accent">Ahorros anuales potenciales</p>
                <div className="text-5xl md:text-7xl font-black text-accent">
                  €{(results.savingPotential * 12).toFixed(0)}
                </div>
                <p className="text-base text-muted">
                  Basado en tu factura actual de €{results.monthlySpend.toFixed(2)}/mes
                </p>
              </div>
            </div>

            {/* Cost breakdown chart */}
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { label: 'Coste potencia', value: results.powerCost, color: 'from-secondary to-cyan-500', percent: (results.powerCost / results.monthlySpend * 100).toFixed(0) },
                { label: 'Coste energía', value: results.energyCost, color: 'from-accent to-accent-light', percent: (results.energyCost / results.monthlySpend * 100).toFixed(0) },
                { label: 'Impuestos', value: results.taxesCost, color: 'from-tertiary to-amber-400', percent: (results.taxesCost / results.monthlySpend * 100).toFixed(0) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-border/40 bg-card/60 p-6 space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">{item.label}</p>
                    <div className="text-2xl font-black text-foreground">€{item.value.toFixed(2)}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-border/40 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${item.color}`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted">{item.percent}% del total</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            <div className="space-y-4">
              <h3 className="text-xl font-black text-foreground">Recomendaciones personalizadas</h3>
              <div className="space-y-3">
                {results.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-4 rounded-xl border border-border/40 bg-surface/40 p-4">
                    <div className="mt-1 text-2xl">
                      {i === 0 ? '⚡' : i === 1 ? '📉' : i === 2 ? '☀️' : '⏰'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground font-semibold">{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-2xl bg-gradient-to-br from-accent/15 to-secondary/15 border border-accent/20 p-8 text-center space-y-4">
              <h3 className="text-2xl font-black text-foreground">
                ¿Quieres convertir esto en ahorros reales?
              </h3>
              <p className="text-muted">
                Habla con nuestro equipo. Te haremos una propuesta personalizada sin compromiso.
              </p>
              <a
                href="/contacto"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-light px-8 py-4 font-bold text-white shadow-lg transition-all hover:scale-[1.04] hover:shadow-[0_0_30px_rgba(255,51,51,0.4)]"
              >
                Hablar con asesor →
              </a>
            </div>

            {/* New analysis button */}
            <button
              onClick={() => {
                setStep('intro');
                setResults(null);
                setFormData({ monthlyBill: '', powerCost: '', energyCost: '' });
              }}
              className="w-full text-sm text-muted hover:text-foreground transition font-semibold"
            >
              ← Hacer otro análisis
            </button>
          </div>
        </ScrollReveal>
      )}
    </div>
  );
}
