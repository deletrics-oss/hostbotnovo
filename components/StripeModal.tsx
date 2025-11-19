
import React, { useState } from 'react';
import { X, Check, CreditCard, ExternalLink } from 'lucide-react';

interface StripeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan?: (plan: any) => void;
  inline?: boolean;
}

const STRIPE_PRODUCTS = [
  {
    id: 'plan_free',
    name: 'Plano Grátis',
    price: 'R$ 0,00/mês',
    description: 'Ideal para testes e validação.',
    features: ['1 Dispositivo', 'Respostas Automáticas', 'Suporte da Comunidade'],
    highlight: false
  },
  {
    id: 'prod_TSBEUvesZnyFJO',
    name: 'Plano Mensal',
    price: 'R$ 49,90/mês',
    description: 'Acesso essencial para gestão de atendimento.',
    features: ['1 Dispositivo', 'Regras de Resposta', 'Dashboard de Gestão', 'Suporte Básico'],
    highlight: false
  },
  {
    id: 'prod_TSBFAZOMsCNIAT',
    name: 'Bot Fixo',
    price: 'R$ 97,00/mês',
    description: 'Ideal para operação contínua e estável.',
    features: ['1 Dispositivo Fixo', 'Regras Avançadas JSON', 'IA Gemini Integrada', 'Suporte Prioritário'],
    highlight: true
  },
  {
    id: 'prod_TSBFZleC61Rm5y',
    name: 'Novo Cliente + Banco',
    price: 'R$ 197,00/mês',
    description: 'Infraestrutura dedicada para revenda ou alta demanda.',
    features: ['Dispositivos Ilimitados', 'Banco de Dados Isolado', 'Gestão de Múltiplos Clientes', 'API de Envio Liberada'],
    highlight: false
  }
];

export const StripeModal: React.FC<StripeModalProps> = ({ isOpen, onClose, onSelectPlan, inline = false }) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubscribe = (plan: any) => {
    if (onSelectPlan) {
        onSelectPlan(plan);
    } else {
        setLoadingId(plan.id);
        // Simulate redirection
        setTimeout(() => {
            setLoadingId(null);
            alert(`Redirecionando para checkout Stripe (Produto: ${plan.id})...`);
            onClose();
        }, 1500);
    }
  };

  const Content = (
    <div className={`${inline ? '' : 'bg-slate-800 rounded-xl shadow-2xl border border-slate-600 w-full max-w-5xl max-h-full'}`}>
          {!inline && (
          <div className="flex items-center justify-between p-5 border-b border-slate-700">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard className="text-purple-400" /> Assinatura Premium
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 bg-transparent hover:bg-slate-700 hover:text-white rounded-lg text-sm w-8 h-8 ml-auto inline-flex justify-center items-center transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          )}

          <div className={`${inline ? '' : 'p-6'} space-y-6`}>
            {!inline && <p className="text-slate-300 text-center mb-4">Escolha o plano ideal.</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
              {STRIPE_PRODUCTS.map((plan) => (
                <div 
                  key={plan.id} 
                  className={`border rounded-lg p-5 flex flex-col transition-all hover:transform hover:-translate-y-1 ${
                    plan.highlight 
                      ? 'border-purple-500 bg-slate-700/50 relative shadow-lg shadow-purple-900/20' 
                      : 'border-slate-600 bg-slate-800'
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Recomendado
                    </span>
                  )}
                  <h4 className="text-lg font-bold text-white mb-1">{plan.name}</h4>
                  <p className="text-xs text-slate-400 mb-4 min-h-[32px]">{plan.description}</p>
                  <div className="text-xl font-bold text-green-400 mb-6">{plan.price}</div>
                  
                  <ul className="space-y-3 mb-8 flex-grow">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center text-xs text-slate-300">
                        <Check className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <button 
                    onClick={() => handleSubscribe(plan)}
                    disabled={loadingId !== null}
                    className={`w-full py-2 px-4 rounded-lg font-bold text-xs transition-all flex justify-center items-center gap-2 ${
                      plan.highlight
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg'
                        : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-500'
                    }`}
                  >
                    {loadingId === plan.id ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                    ) : (
                      <>
                        {onSelectPlan ? 'Selecionar' : 'Assinar'} <ExternalLink size={12} />
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {!inline && (
          <div className="p-4 border-t border-slate-700 text-center text-xs text-slate-500 flex justify-center gap-4">
            <span>🔒 Pagamento Seguro via Stripe</span>
            <span>💳 Liberação Imediata</span>
            <span>📄 Nota Fiscal Automática</span>
          </div>
          )}
    </div>
  );

  if (inline) return Content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-6xl max-h-full">
        {Content}
      </div>
    </div>
  );
};
