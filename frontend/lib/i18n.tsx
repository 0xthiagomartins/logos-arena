"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "pt-BR" | "en";

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string) => string;
};

const STORAGE_KEY = "logosarena:language";

const DICTIONARY: Record<AppLanguage, Record<string, string>> = {
  "pt-BR": {
    "nav.home": "Home",
    "nav.gallery": "Galeria",
    "nav.language": "Idioma",
    "nav.login": "Logar",
    "nav.signup": "Cadastrar",
    "nav.auth_disabled": "Auth será habilitado com Clerk",
    "auth.required_title": "Login necessário",
    "auth.required_description": "Faça login ou cadastre-se para criar novos debates.",
    "auth.sign_in": "Entrar",
    "auth.sign_up": "Criar conta",
    "auth.cancel": "Cancelar",
    "home.title": "LogosArena",
    "home.subtitle":
      "Debates estruturados com IA, rounds rastreáveis e mediação explicável em um fluxo claro: criar, acompanhar, concluir.",
    "home.new_debate": "Novo debate",
    "home.my_debates": "Meus debates",
    "home.engine": "debate engine",
    "gallery.title": "Galeria",
    "gallery.subtitle_loading": "Carregando debates...",
    "gallery.subtitle_ready": "Explore debates públicos e os seus debates locais.",
    "gallery.new_debate": "Novo debate",
    "gallery.my_section": "Minha galeria",
    "gallery.public_section": "Galeria pública",
    "gallery.empty_my": "Você ainda não criou debates neste navegador.",
    "gallery.empty_public": "Nenhum debate público disponível no momento.",
    "gallery.empty_all": "Nenhum debate disponível.",
    "status.completed": "Concluído",
    "status.running": "Em andamento",
    "status.failed": "Falhou",
    "status.draft": "Rascunho",
    "debate.back_to_gallery": "Voltar para meus debates",
    "debate.preparing": "Preparando debate...",
    "debate.thesis": "Tese",
    "debate.no_result": "SEM RESULTADO",
    "debate.loading_question": "Carregando pergunta do debate...",
    "debate.load_error": "Não foi possível carregar. Tente novamente.",
    "debate.round_summary_fallback": "Resumo ainda não disponível para este round.",
    "debate.show_round_summary": "Clique para ver a síntese da rodada",
    "debate.turn": "Turno",
    "debate.side.pro": "Pro",
    "debate.side.con": "Con",
    "debate.phase.opening": "Abertura",
    "debate.phase.rebuttal": "Réplica",
    "debate.phase.closing": "Tréplica",
    "debate.streaming_generating_argument": "_Gerando argumento..._",
    "debate.streaming_waiting_response": "_Aguardando resposta..._",
    "debate.streaming_mediator_analyzing": "_Mediador analisando..._",
    "debate.mediator_result_pro": "Resultado: PRO",
    "debate.mediator_result_con": "Resultado: CON",
    "debate.mediator_result_depende": "Resultado: DEPENDE",
    "debate.mediator_result_inconclusivo": "Resultado: INCONCLUSIVO",
    "debate.mediator_result_none": "Resultado: sem classificação",
    "debate.no_content": "_Sem conteúdo._",
    "debate.mediator_summary": "Resumo",
    "debate.mediator_analysis_logic": "Análise Crítica / Lógica",
    "debate.rounds_empty_prefix": "Sem rounds ainda. Clique em",
    "debate.rounds_empty_suffix": "para iniciar.",
    "debate.round_of": "{current}/{total}",
    "debate.prev": "← Anterior",
    "debate.next": "Próximo →",
    "debate.step_running": "Executando próximo step em tempo real...",
    "debate.finished_hint": "Debate finalizado. Abra o resultado do mediador para revisar a conclusão.",
    "debate.continue_hint": "Continue para avançar o debate.",
    "debate.finished_badge": "Debate concluído",
    "debate.continue": "Continuar",
    "debate.open_continue": "Continuar abertamente",
    "debate.next_claim": "Próxima afirmação",
    "debate.extend_debate": "Aprofundar (mais uma réplica)",
    "debate.rendering_step": "Processando...",
    "debate.mediator_modal_title": "Análise do mediador",
    "debate.close": "Fechar",
    "debate.advance_error": "Não foi possível avançar o debate.",
    "debate.stream_fail": "Falha ao processar stream.",
    "debate.generating_content": "Gerando conteúdo...",
    "debate.phase.round_start": "Iniciando novo round...",
    "debate.phase.summary_start": "Mediador analisando a qualidade do round...",
    "debate.phase.mediation_start": "Mediador escrevendo o relatório final...",
    "debate.phase.default": "Processando step...",
    "debate.outcome.pro_meaning": "O mediador avaliou que os argumentos do lado Pro foram mais fortes.",
    "debate.outcome.con_meaning": "O mediador avaliou que os argumentos do lado Con foram mais fortes.",
    "debate.outcome.depende_meaning": "O mediador concluiu que a resposta depende de premissas ou contexto adotado.",
    "debate.outcome.inconclusivo_meaning":
      "O mediador concluiu que não há evidência argumentativa suficiente para decidir.",
    "debate.outcome.none_meaning": "Resultado ainda não definido.",
    "debate.outcome.badge.pro": "PRO",
    "debate.outcome.badge.con": "CON",
    "debate.outcome.badge.depende": "DEPENDE",
    "debate.outcome.badge.inconclusivo": "INCONCLUSIVO",
    "debate.outcome.badge.none": "SEM RESULTADO",
    "loading.round.1": "Convocando estrategistas do lado Pro e Con...",
    "loading.round.2": "Pesando premissas e contra-argumentos...",
    "loading.round.3": "Refinando lógica, clareza e consistência...",
    "loading.round.4": "Mediador auditando possíveis falhas...",
    "loading.mediation.1": "Mediador compilando os três rounds...",
    "loading.mediation.2": "Comparando forças e fraquezas finais...",
    "loading.mediation.3": "Gerando veredito explicável em Markdown...",
    "loading.mediation.4": "Quase pronto: estruturando a conclusão...",
    "new.back_home": "Voltar para home",
    "new.badge": "setup",
    "new.title": "Novo debate",
    "new.subtitle": "Configure a tese e o estilo do mediador para iniciar um debate estruturado.",
    "new.field.title": "Título",
    "new.field.title_placeholder": "Ex.: Cristo vegano (ético)?",
    "new.field.title_help": "Use um título curto e direto para facilitar a leitura na galeria.",
    "new.field.question": "Pergunta / tese",
    "new.field.question_placeholder": "Ex.: Cristo era vegano em sentido ético?",
    "new.field.question_help":
      "Essa frase guia todo o debate. Quanto mais clara a tese, melhor a qualidade dos argumentos.",
    "new.mediator.title": "Modo de explicação / rigor",
    "new.mediator.simple_title": "Explicar de forma simples",
    "new.mediator.simple_desc": "Deixa a linguagem mais acessível, como se fosse para alguém de 12 anos.",
    "new.mediator.rigor_title": "Rigor formal",
    "new.mediator.rigor_desc": "Pede que o modelo deixe claro premissas, passos lógicos e conclusão.",
    "new.first_speaker.label": "Quem começa?",
    "new.first_speaker.pro": "Pro (a favor)",
    "new.first_speaker.con": "Con (contra)",
    "new.validation.title_required": "Preencha o título do debate.",
    "new.validation.question_required": "Preencha a pergunta / tese do debate.",
    "new.validation.submit_error": "Erro ao criar. Tente de novo.",
    "new.cta.default": "Criar debate",
    "new.cta.loading": "Criando...",
  },
  en: {
    "nav.home": "Home",
    "nav.gallery": "Gallery",
    "nav.language": "Language",
    "nav.login": "Log in",
    "nav.signup": "Sign up",
    "nav.auth_disabled": "Auth will be enabled with Clerk",
    "auth.required_title": "Login required",
    "auth.required_description": "Sign in or sign up to create new debates.",
    "auth.sign_in": "Sign in",
    "auth.sign_up": "Create account",
    "auth.cancel": "Cancel",
    "home.title": "LogosArena",
    "home.subtitle":
      "Structured AI debates with traceable rounds and explainable mediation in a clear flow: create, follow, conclude.",
    "home.new_debate": "New debate",
    "home.my_debates": "My debates",
    "home.engine": "debate engine",
    "gallery.title": "Gallery",
    "gallery.subtitle_loading": "Loading debates...",
    "gallery.subtitle_ready": "Explore public debates and your local debates.",
    "gallery.new_debate": "New debate",
    "gallery.my_section": "My gallery",
    "gallery.public_section": "Public gallery",
    "gallery.empty_my": "You haven't created debates in this browser yet.",
    "gallery.empty_public": "No public debates available right now.",
    "gallery.empty_all": "No debates available.",
    "status.completed": "Completed",
    "status.running": "Running",
    "status.failed": "Failed",
    "status.draft": "Draft",
    "debate.back_to_gallery": "Back to my debates",
    "debate.preparing": "Preparing debate...",
    "debate.thesis": "Thesis",
    "debate.no_result": "NO RESULT",
    "debate.loading_question": "Loading debate thesis...",
    "debate.load_error": "Could not load. Please try again.",
    "debate.round_summary_fallback": "Summary is not available for this round yet.",
    "debate.show_round_summary": "Click to view round synthesis",
    "debate.turn": "Turn",
    "debate.side.pro": "Pro",
    "debate.side.con": "Con",
    "debate.phase.opening": "Opening",
    "debate.phase.rebuttal": "Rebuttal",
    "debate.phase.closing": "Closing",
    "debate.streaming_generating_argument": "_Generating argument..._",
    "debate.streaming_waiting_response": "_Waiting for response..._",
    "debate.streaming_mediator_analyzing": "_Mediator analyzing..._",
    "debate.mediator_result_pro": "Result: PRO",
    "debate.mediator_result_con": "Result: CON",
    "debate.mediator_result_depende": "Result: IT DEPENDS",
    "debate.mediator_result_inconclusivo": "Result: INCONCLUSIVE",
    "debate.mediator_result_none": "Result: unclassified",
    "debate.no_content": "_No content._",
    "debate.mediator_summary": "Summary",
    "debate.mediator_analysis_logic": "Critical Analysis / Logic",
    "debate.rounds_empty_prefix": "No rounds yet. Click",
    "debate.rounds_empty_suffix": "to start.",
    "debate.round_of": "{current}/{total}",
    "debate.prev": "← Previous",
    "debate.next": "Next →",
    "debate.step_running": "Executing next step in real time...",
    "debate.finished_hint": "Debate finished. Open mediator result to review the conclusion.",
    "debate.continue_hint": "Continue to advance the debate.",
    "debate.finished_badge": "Debate completed",
    "debate.continue": "Continue",
    "debate.open_continue": "Continue openly",
    "debate.next_claim": "Next assertion",
    "debate.extend_debate": "Extend (one more rebuttal each)",
    "debate.rendering_step": "Processing...",
    "debate.mediator_modal_title": "Mediator analysis",
    "debate.close": "Close",
    "debate.advance_error": "Could not advance the debate.",
    "debate.stream_fail": "Failed to process stream.",
    "debate.generating_content": "Generating content...",
    "debate.phase.round_start": "Starting next round...",
    "debate.phase.summary_start": "Mediator is evaluating round quality...",
    "debate.phase.mediation_start": "Mediator is writing the final report...",
    "debate.phase.default": "Processing step...",
    "debate.outcome.pro_meaning": "The mediator assessed that Pro side arguments were stronger.",
    "debate.outcome.con_meaning": "The mediator assessed that Con side arguments were stronger.",
    "debate.outcome.depende_meaning":
      "The mediator concluded that the answer depends on assumptions or chosen context.",
    "debate.outcome.inconclusivo_meaning":
      "The mediator concluded there is not enough argumentative evidence to decide.",
    "debate.outcome.none_meaning": "Result is not defined yet.",
    "debate.outcome.badge.pro": "PRO",
    "debate.outcome.badge.con": "CON",
    "debate.outcome.badge.depende": "IT DEPENDS",
    "debate.outcome.badge.inconclusivo": "INCONCLUSIVE",
    "debate.outcome.badge.none": "NO RESULT",
    "loading.round.1": "Summoning strategists for Pro and Con...",
    "loading.round.2": "Weighing premises and counterarguments...",
    "loading.round.3": "Refining logic, clarity, and consistency...",
    "loading.round.4": "Mediator auditing potential flaws...",
    "loading.mediation.1": "Mediator compiling all three rounds...",
    "loading.mediation.2": "Comparing final strengths and weaknesses...",
    "loading.mediation.3": "Generating explainable verdict in Markdown...",
    "loading.mediation.4": "Almost done: structuring the conclusion...",
    "new.back_home": "Back to home",
    "new.badge": "setup",
    "new.title": "New debate",
    "new.subtitle": "Configure the thesis and mediator style to start a structured debate.",
    "new.field.title": "Title",
    "new.field.title_placeholder": "Ex.: Was Christ ethically vegan?",
    "new.field.title_help": "Use a short and direct title to improve readability in the gallery.",
    "new.field.question": "Question / thesis",
    "new.field.question_placeholder": "Ex.: Was Christ ethically vegan?",
    "new.field.question_help":
      "This sentence guides the whole debate. The clearer the thesis, the better the argument quality.",
    "new.mediator.title": "Explanation / rigor mode",
    "new.mediator.simple_title": "Explain in simple terms",
    "new.mediator.simple_desc": "Uses more accessible language, as if explaining to a 12-year-old.",
    "new.mediator.rigor_title": "Formal rigor",
    "new.mediator.rigor_desc": "Requests clear premises, logical steps, and conclusion.",
    "new.first_speaker.label": "Who starts?",
    "new.first_speaker.pro": "Pro (in favor)",
    "new.first_speaker.con": "Con (against)",
    "new.validation.title_required": "Please fill in the debate title.",
    "new.validation.question_required": "Please fill in the debate question/thesis.",
    "new.validation.submit_error": "Could not create debate. Please try again.",
    "new.cta.default": "Create debate",
    "new.cta.loading": "Creating...",
  },
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("pt-BR");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "pt-BR" || saved === "en") {
      setLanguageState(saved);
    }
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const setLanguage = (lang: AppLanguage) => {
      setLanguageState(lang);
      window.localStorage.setItem(STORAGE_KEY, lang);
    };

    const t = (key: string) => {
      return DICTIONARY[language][key] ?? key;
    };

    return { language, setLanguage, t };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
