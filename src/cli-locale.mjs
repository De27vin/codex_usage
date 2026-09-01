const LANGUAGE_NAMES = {
  de: {
    bundleBuilt: (directory, count) => `UI-Bundle in ${directory} erstellt (${count} Dateien).`,
    refreshed: (ms, sessions) => `Daten aktualisiert in ${ms} ms (${sessions} Sitzungen).`,
    refreshFailed: (error) => `Aktualisierung fehlgeschlagen: ${error}`,
    localOnly: "Nur lokale Daten — nichts wird an andere Stellen gesendet.",
    meshEnabled: "Lokaler Modus + ausgehende Mesh-Sammlung aktiviert.",
    meshHub: "Mesh-Hub-Modus — nur signierte und minimierte Metadaten werden akzeptiert.",
  },
  en: {
    bundleBuilt: (directory, count) => `UI bundle generated in ${directory} (${count} files).`,
    refreshed: (ms, sessions) => `Data refreshed in ${ms} ms (${sessions} sessions).`,
    refreshFailed: (error) => `Refresh failed: ${error}`,
    localOnly: "Local-only reading — no data is sent elsewhere.",
    meshEnabled: "Local mode + outbound Mesh collector enabled.",
    meshHub: "Mesh Hub mode — only signed, minimized metadata is accepted.",
  },
  es: {
    bundleBuilt: (directory, count) => `Paquete de UI generado en ${directory} (${count} archivos).`,
    refreshed: (ms, sessions) => `Datos actualizados en ${ms} ms (${sessions} sesiones).`,
    refreshFailed: (error) => `Error de actualización: ${error}`,
    localOnly: "Lectura solo local — no se envían datos a otros lugares.",
    meshEnabled: "Modo local + recopilador Mesh saliente activado.",
    meshHub: "Modo Mesh Hub — solo se aceptan metadatos firmados y minimizados.",
  },
  fr: {
    bundleBuilt: (directory, count) => `Bundle UI généré dans ${directory} (${count} fichiers).`,
    refreshed: (ms, sessions) => `Données actualisées en ${ms} ms (${sessions} sessions).`,
    refreshFailed: (error) => `Actualisation impossible : ${error}`,
    localOnly: "Lecture locale uniquement — aucune donnée n’est envoyée ailleurs.",
    meshEnabled: "Mode local + collecteur Mesh sortant activé.",
    meshHub: "Mode Mesh Hub — seules les métadonnées signées et minimisées sont acceptées.",
  },
  it: {
    bundleBuilt: (directory, count) => `Bundle UI generato in ${directory} (${count} file).`,
    refreshed: (ms, sessions) => `Dati aggiornati in ${ms} ms (${sessions} sessioni).`,
    refreshFailed: (error) => `Aggiornamento non riuscito: ${error}`,
    localOnly: "Lettura solo locale — nessun dato viene inviato altrove.",
    meshEnabled: "Modalità locale + raccolta Mesh in uscita attivata.",
    meshHub: "Modalità Mesh Hub — sono accettati solo metadati firmati e minimizzati.",
  },
  ja: {
    bundleBuilt: (directory, count) => `UIバンドルを${directory}に生成しました（${count}ファイル）。`,
    refreshed: (ms, sessions) => `${ms} msでデータを更新しました（${sessions}セッション）。`,
    refreshFailed: (error) => `更新に失敗しました: ${error}`,
    localOnly: "ローカルのみ — データは外部に送信されません。",
    meshEnabled: "ローカルモード + Mesh送信コレクターが有効です。",
    meshHub: "Mesh Hubモード — 署名済みで最小化されたメタデータのみ受け付けます。",
  },
  pt: {
    bundleBuilt: (directory, count) => `Pacote de UI gerado em ${directory} (${count} ficheiros).`,
    refreshed: (ms, sessions) => `Dados atualizados em ${ms} ms (${sessions} sessões).`,
    refreshFailed: (error) => `Falha ao atualizar: ${error}`,
    localOnly: "Leitura apenas local — nenhum dado é enviado para outro lugar.",
    meshEnabled: "Modo local + coletor Mesh de saída ativado.",
    meshHub: "Modo Mesh Hub — apenas metadados assinados e minimizados são aceitos.",
  },
  ru: {
    bundleBuilt: (directory, count) => `UI-пакет создан в ${directory} (файлов: ${count}).`,
    refreshed: (ms, sessions) => `Данные обновлены за ${ms} мс (сеансов: ${sessions}).`,
    refreshFailed: (error) => `Не удалось обновить данные: ${error}`,
    localOnly: "Только локальное чтение — данные никуда не отправляются.",
    meshEnabled: "Локальный режим + исходящий сборщик Mesh включён.",
    meshHub: "Режим Mesh Hub — принимаются только подписанные минимизированные метаданные.",
  },
  zh: {
    bundleBuilt: (directory, count) => `UI 包已生成到 ${directory}（${count} 个文件）。`,
    refreshed: (ms, sessions) => `数据已在 ${ms} ms 内更新（${sessions} 个会话）。`,
    refreshFailed: (error) => `更新失败：${error}`,
    localOnly: "仅本地读取 — 不会向其他位置发送数据。",
    meshEnabled: "本地模式 + 已启用 Mesh 出站收集器。",
    meshHub: "Mesh Hub 模式 — 仅接受已签名且最小化的元数据。",
  },
};

function language() {
  try {
    // Unix-like systems expose the locale through these variables; Windows
    // generally supplies it through Intl. Prefer the explicit environment
    // when available so minimal containers behave consistently too.
    const environmentValues = [process.env.LANGUAGE, process.env.LC_ALL, process.env.LC_MESSAGES, process.env.LANG]
      .flatMap((value) => String(value || "").split(":"))
      .filter((value) => value && !/^(?:c|posix|und)(?:[._-]|$)/i.test(value));
    const value = environmentValues[0] || Intl.DateTimeFormat().resolvedOptions().locale || "en";
    const code = value.toLowerCase().split(/[-_]/)[0];
    return LANGUAGE_NAMES[code] ? code : "en";
  } catch {
    return "en";
  }
}

export function cliText(key, ...args) {
  const messages = LANGUAGE_NAMES[language()] || LANGUAGE_NAMES.en;
  const value = messages[key] ?? LANGUAGE_NAMES.en[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}
