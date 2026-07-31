import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { toast } from "sonner";
import { diffLines } from "diff";
import { Columns2, Eye, FilePlus2, GitCompareArrows, History, LogOut, Moon, Rocket, Save, SquarePen, Sun, Trash2 } from "lucide-react";
import { api, subscribePending, type FileEntry, type Session, type Version } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const CARD_TPL = `
---

## Название кейса
<<Цвет>>
green
<<Картинка>>
../img/portfolio/XX-00-slug.png
<<Картинка мобильная>>
../img/portfolio/XX-00-slug-mobile.png
<<Задача>>
Коротко о задаче.
<<Решение>>
Коротко о решении.
<<Цвет кнопки>>
green
<<Текст кнопки>>
Подробнее
<<Ссылка кнопки>>
slug/
`;

const CV_TPL = `
---

<<Период>>
январь 2026 —
по настоящее время
<<Должность>>
Product Designer
<<Компания>>
Компания
<<Описание>>
Чем занималась и какие результаты.
`;

// Глобальный индикатор сетевой активности: тонкая полоса у верхней кромки окна.
// Рисуется поверх (position: fixed), ничего в раскладке не смещает. Появляется,
// пока есть хоть один запрос «в полёте», и плавно исчезает по завершении.
function GlobalActivity() {
  const [pending, setPending] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => subscribePending(setPending), []);
  useEffect(() => {
    if (pending > 0) {
      setVisible(true);
      return;
    }
    // короткая задержка, чтобы полоса успела «докатиться» до конца
    const id = setTimeout(() => setVisible(false), 250);
    return () => clearTimeout(id);
  }, [pending]);
  const active = pending > 0;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease" }}
      role="status"
      aria-label={active ? "Идёт загрузка" : undefined}
      aria-live="polite"
    >
      <div className={`h-full bg-primary ${active ? "activity-indeterminate" : "w-full"}`} />
    </div>
  );
}

function formatVersionDate(date: string | null) {
  if (!date) return "без даты";
  return new Date(date).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DiffSide = { label: string; content: string };

function DiffView({ from, to }: { from: DiffSide; to: DiffSide }) {
  const parts = useMemo(() => diffLines(from.content, to.content), [from.content, to.content]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2 text-sm">
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">{from.label}</span>
        <span className="text-muted-foreground">→</span>
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">{to.label}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[13px] leading-5">
        {parts.map((part, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap ${
              part.added ? "bg-emerald-100" : part.removed ? "bg-red-100" : "text-muted-foreground"
            }`}
          >
            {part.value.replace(/\n$/, "")}
          </div>
        ))}
      </div>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.login(password);
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex h-screen items-center justify-center">
      <form onSubmit={submit} className="w-80 space-y-4 rounded-xl border p-8 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold">Админка olga-ko.com</h1>
          <p className="text-sm text-muted-foreground">Редактор контента</p>
        </div>
        <Input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <Button className="w-full" disabled={busy || !password}>
          Войти
        </Button>
      </form>
    </div>
  );
}

function DeployBadge() {
  const [state, setState] = useState<{ status: string; conclusion?: string | null; url?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const d = await api.deploy();
        if (alive) setState(d);
      } catch {
        /* молча */
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  if (!state || state.status === "local" || state.status === "none") return null;
  const running = state.status !== "completed";
  const ok = state.conclusion === "success";
  return (
    <a href={state.url} target="_blank" rel="noreferrer">
      <Badge variant={running ? "warning" : ok ? "success" : "destructive"}>
        {running ? "Деплой идёт…" : ok ? "Деплой: успех" : "Деплой: упал"}
      </Badge>
    </a>
  );
}

function NewPageDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      await api.scaffold({ title, slug });
      toast.success(`Страница «${title}» создана — /${slug}/`);
      setOpen(false);
      setTitle("");
      setSlug("");
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <FilePlus2 /> Новая страница
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Новая md-страница</DialogTitle>
        <DialogDescription>
          Создаст страницу с content.md, шаблоном и пунктом на разводной.
        </DialogDescription>
        <div className="space-y-3">
          <Input placeholder="Название (для разводной)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            placeholder="слаг-в-url"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          />
          <p className="text-xs text-muted-foreground">Адрес: olga-ko.com/{slug || "…"}/</p>
          <Button className="w-full" disabled={busy || !title || !/^[a-z0-9-]{2,}$/.test(slug)} onClick={create}>
            Создать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Тема интерфейса: из localStorage, иначе — системная. Класс .dark вешаем
// на <html>, чтобы токены из index.css переключились для всего приложения.
function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark] as const;
}

export default function App() {
  const [dark, setDark] = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [file, setFile] = useState<FileEntry | null>(null);
  const [content, setContent] = useState("");
  const [loadedContent, setLoadedContent] = useState("");
  const [sha, setSha] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [viewSha, setViewSha] = useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [diffPick, setDiffPick] = useState<Version[]>([]);
  const [diffData, setDiffData] = useState<{ from: DiffSide; to: DiffSide } | null>(null);
  const [previewSrc, setPreviewSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(false);
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const skeletonKeyRef = useRef<string | null>(null);
  const github = session?.mode === "github";
  const dirty = content !== loadedContent;
  const lsKey = file ? `autosave:${file.path}` : null;
  // самая свежая версия из main+drafts — «рабочая»; всё остальное — просмотр истории
  const latestSha = versions[0]?.sha ?? null;
  const isLatest = !github || !latestSha || viewSha === latestSha;

  const refreshSession = useCallback(() => api.session().then(setSession), []);
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const loadFiles = useCallback(async () => {
    try {
      setFiles(await api.files());
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, []);
  useEffect(() => {
    if (session?.auth) loadFiles();
  }, [session, loadFiles]);

  // открытие файла: всегда самая свежая версия (main или drafts — что новее)
  const openFile = useCallback(
    async (f: FileEntry, opts?: { skipDirtyCheck?: boolean }) => {
      if (!opts?.skipDirtyCheck && dirty && !window.confirm("Есть несохранённые изменения — открыть другой файл без сохранения?")) return;
      try {
        let vs: Version[] = [];
        if (github) vs = await api.versions(f.path);
        const data = await api.file(f.path, vs[0]?.sha ?? "main");
        setFile(f);
        setVersions(vs);
        setViewSha(vs[0]?.sha ?? null);
        setDiffMode(false);
        setDiffPick([]);
        setSha(data.sha);
        setLoadedContent(data.content);
        const saved = localStorage.getItem(`autosave:${f.path}`);
        if (saved !== null && saved !== data.content) {
          setContent(saved);
          toast("Восстановлено несохранённое из автосейва", {
            action: {
              label: "Сбросить",
              onClick: () => {
                localStorage.removeItem(`autosave:${f.path}`);
                setContent(data.content);
              },
            },
          });
        } else {
          setContent(data.content);
        }
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [github, dirty]
  );

  // открыть конкретную версию из ленты
  const openVersion = useCallback(
    async (v: Version) => {
      if (!file) return;
      if (dirty && !window.confirm("Есть несохранённые изменения — открыть другую версию без сохранения?")) return;
      try {
        const data = await api.file(file.path, v.sha);
        setViewSha(v.sha);
        setSha(data.sha);
        setLoadedContent(data.content);
        setContent(data.content);
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [file, dirty]
  );

  // автосейв в localStorage
  useEffect(() => {
    if (!lsKey) return;
    const id = setTimeout(() => {
      if (dirty) localStorage.setItem(lsKey, content);
      else localStorage.removeItem(lsKey);
    }, 1500);
    return () => clearTimeout(id);
  }, [content, dirty, lsKey]);

  // живое превью с дебаунсом; при том же файле обновляем только <body> внутри
  // iframe (документ живёт дальше — позиция скролла сохраняется)
  useEffect(() => {
    if (!file) return;
    const key = file.path;
    const id = setTimeout(async () => {
      try {
        const html = await api.preview({
          type: file.type,
          lang: file.lang,
          md: content,
          pagePath: file.pagePath,
        });
        const doc = iframeRef.current?.contentDocument;
        if (skeletonKeyRef.current === key && doc && doc.body) {
          const next = new DOMParser().parseFromString(html, "text/html");
          doc.body.innerHTML = next.body.innerHTML;
          doc.body.className = next.body.className;
        } else {
          skeletonKeyRef.current = key;
          setPreviewSrc(html);
        }
      } catch {
        /* превью не критично */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [content, file]);

  // режим сравнения: выбраны две версии — грузим обе и показываем дифф
  useEffect(() => {
    if (!diffMode || diffPick.length !== 2 || !file) {
      setDiffData(null);
      return;
    }
    const [from, to] = [...diffPick].sort(
      (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );
    let alive = true;
    Promise.all([api.file(file.path, from.sha), api.file(file.path, to.sha)])
      .then(([a, b]) => {
        if (!alive) return;
        setDiffData({
          from: { label: formatVersionDate(from.date), content: a.content },
          to: { label: formatVersionDate(to.date), content: b.content },
        });
      })
      .catch((err) => toast.error((err as Error).message));
    return () => {
      alive = false;
    };
  }, [diffMode, diffPick, file]);

  const doDeleteVersion = async (v: Version) => {
    if (!file) return;
    if (!window.confirm(`Удалить версию от ${formatVersionDate(v.date)} навсегда? Она исчезнет из истории.`)) return;
    setBusy(true);
    try {
      await api.deleteVersion(file.path, v.sha);
      toast.success("Версия удалена");
      const vs = await api.versions(file.path);
      setVersions(vs);
      setDiffPick((picks) => picks.filter((p) => p.sha !== v.sha));
      // если удалили открытую версию — встаём на самую свежую
      if (viewSha === v.sha) {
        const data = await api.file(file.path, vs[0]?.sha ?? "main");
        setViewSha(vs[0]?.sha ?? null);
        setSha(data.sha);
        setLoadedContent(data.content);
        setContent(data.content);
      }
      loadFiles();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const togglePick = (v: Version) => {
    setDiffPick((picks) =>
      picks.some((p) => p.sha === v.sha) ? picks.filter((p) => p.sha !== v.sha) : [...picks, v].slice(-2)
    );
  };

  const doSave = async (target: "main" | "drafts") => {
    if (!file) return;
    setBusy(true);
    try {
      await api.save({ path: file.path, content, sha, target });
      if (lsKey) localStorage.removeItem(lsKey);
      setLoadedContent(content);
      toast.success(target === "main" ? "Опубликовано — деплой запущен" : "Версия сохранена");
      loadFiles();
      // сохранение создало новый коммит — обновляем ленту и встаём на свежую версию
      if (github) {
        const vs = await api.versions(file.path);
        setVersions(vs);
        setViewSha(vs[0]?.sha ?? null);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const insertTemplate = () => {
    if (!file) return;
    const tpl = file.type === "portfolio" ? CARD_TPL : CV_TPL;
    const view = cmRef.current?.view;
    if (view) {
      const end = view.state.doc.length;
      view.dispatch({ changes: { from: end, insert: tpl }, selection: { anchor: end + 6 } });
      view.focus();
    } else {
      setContent((c) => c + tpl);
    }
  };

  const groups = useMemo(() => {
    const g = new Map<string, FileEntry[]>();
    for (const f of files) {
      if (!g.has(f.group)) g.set(f.group, []);
      g.get(f.group)!.push(f);
    }
    return [...g.entries()];
  }, [files]);

  if (!session) return <GlobalActivity />;
  if (!session.auth)
    return (
      <>
        <GlobalActivity />
        <Login onDone={refreshSession} />
      </>
    );

  return (
    <>
      <GlobalActivity />
      {/* Плёнка на время блокирующих операций (сохранение/публикация/удаление):
          перехватывает клики и показывает курсор ожидания, ничего не смещая */}
      {busy && <div className="fixed inset-0 z-[90] cursor-wait bg-foreground/10" aria-hidden="true" />}
      <div className="flex h-screen">
      {/* Сайдбар */}
      <aside className="flex w-64 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">olga-ko.com</div>
            <div className="text-xs text-muted-foreground">{github ? "GitHub-режим" : "локальный режим"}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title={dark ? "Светлая тема" : "Тёмная тема"}
              onClick={() => setDark((v) => !v)}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" size="icon" title="Выйти" onClick={() => api.logout().then(refreshSession)}>
              <LogOut />
            </Button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {groups.map(([group, items]) => (
            <div key={group} className="mb-3">
              <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</div>
              {items.map((f) => (
                <button
                  key={f.path}
                  onClick={() => openFile(f)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                    file?.path === f.path ? "bg-accent font-medium" : ""
                  }`}
                >
                  <span className="truncate">{f.title}</span>
                  {f.hasDraft && <Badge variant="warning">не опубликовано</Badge>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="space-y-2 border-t p-3">
          <NewPageDialog onCreated={loadFiles} />
          <div className="flex justify-center">
            <DeployBadge />
          </div>
        </div>
      </aside>

      {/* Рабочая область */}
      <main className="flex min-w-0 flex-1 flex-col">
        {file ? (
          <>
            <header className="flex items-center gap-3 border-b px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{file.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {file.path}
                  {dirty && " · не сохранено"}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                title={previewOnly ? "Показать редактор" : "Полноэкранное превью"}
                onClick={() => setPreviewOnly((v) => !v)}
              >
                {previewOnly ? <Columns2 /> : <Eye />}
              </Button>
              {github && (
                <Button
                  variant={versionsOpen ? "secondary" : "outline"}
                  size="icon"
                  title="Версии"
                  onClick={() => setVersionsOpen((v) => !v)}
                >
                  <History />
                </Button>
              )}
              {(file.type === "portfolio" || file.type === "cv") && (
                <Button variant="outline" size="sm" onClick={insertTemplate}>
                  <SquarePen /> {file.type === "portfolio" ? "Новая карточка" : "Новая запись"}
                </Button>
              )}
              {github && (
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => doSave("drafts")}>
                  <Save /> Сохранить
                </Button>
              )}
              <Button size="sm" disabled={busy} onClick={() => doSave("main")}>
                <Rocket /> {github ? "Опубликовать" : "Сохранить"}
              </Button>
            </header>
            {!isLatest && (
              <div className="flex items-center gap-3 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900">
                <span className="min-w-0 flex-1 truncate">
                  Вы смотрите версию от {formatVersionDate(versions.find((v) => v.sha === viewSha)?.date ?? null)}
                  {dirty && " (изменена)"}
                </span>
                <Button size="sm" disabled={busy} onClick={() => doSave("main")}>
                  Опубликовать эту версию
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => openVersion(versions[0])}>
                  К последней
                </Button>
              </div>
            )}
            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-1">
                {diffMode ? (
                  diffData ? (
                    <DiffView from={diffData.from} to={diffData.to} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Выберите две версии в списке справа, чтобы сравнить
                    </div>
                  )
                ) : (
                <ResizablePanelGroup direction="horizontal" autoSaveId="editor-split">
                  <ResizablePanel defaultSize={50} minSize={25} className={previewOnly ? "hidden" : undefined}>
                    <CodeMirror
                      ref={cmRef}
                      value={content}
                      height="100%"
                      style={{ height: "100%" }}
                      theme={dark ? "dark" : "light"}
                      extensions={[markdown(), EditorView.lineWrapping]}
                      onChange={setContent}
                      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
                    />
                  </ResizablePanel>
                  <ResizableHandle withHandle className={previewOnly ? "hidden" : undefined} />
                  <ResizablePanel defaultSize={50} minSize={25}>
                    <iframe ref={iframeRef} title="Превью" className="h-full w-full border-0 bg-white" srcDoc={previewSrc} />
                  </ResizablePanel>
                </ResizablePanelGroup>
                )}
              </div>
              {github && versionsOpen && (
                <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l">
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Версии</span>
                    <Button
                      variant={diffMode ? "secondary" : "ghost"}
                      size="sm"
                      title="Сравнить две версии"
                      onClick={() => {
                        setDiffMode((v) => !v);
                        setDiffPick([]);
                      }}
                    >
                      <GitCompareArrows /> Сравнить
                    </Button>
                  </div>
                  {diffMode ? (
                    <div className="border-b px-4 pb-2 text-xs text-muted-foreground">
                      Выбрано {diffPick.length} из 2 — отличия покажутся слева
                    </div>
                  ) : (
                    <div className="border-b px-4 pb-2 text-xs leading-relaxed text-muted-foreground">
                      <b>Сейчас на сайте</b> — опубликовано. <b>Была на сайте</b> — публиковалась
                      раньше. <b>Черновик</b> — сохранён, но не опубликован (можно удалить).
                    </div>
                  )}
                  {versions.length === 0 && (
                    <div className="px-4 py-2 text-sm text-muted-foreground">Пока нет ни одной версии</div>
                  )}
                  {versions.map((v) => {
                    const pickIndex = diffPick.findIndex((p) => p.sha === v.sha);
                    return (
                      <div
                        key={v.sha}
                        role="button"
                        tabIndex={0}
                        onClick={() => (diffMode ? togglePick(v) : openVersion(v))}
                        onKeyDown={(e) => e.key === "Enter" && (diffMode ? togglePick(v) : openVersion(v))}
                        className={`group flex w-full cursor-pointer items-start justify-between gap-2 border-b px-4 py-2.5 text-left text-sm hover:bg-accent ${
                          diffMode ? (pickIndex >= 0 ? "bg-accent" : "") : viewSha === v.sha ? "bg-accent" : ""
                        }`}
                      >
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="flex items-center gap-2 font-medium">
                            {diffMode && (
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                                  pickIndex >= 0 ? "border-primary bg-primary text-primary-foreground" : "border-input"
                                }`}
                              >
                                {pickIndex >= 0 ? pickIndex + 1 : ""}
                              </span>
                            )}
                            {formatVersionDate(v.date)}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            {v.isCurrent ? (
                              <Badge variant="success" title="Эта версия сейчас опубликована на сайте">
                                Сейчас на сайте
                              </Badge>
                            ) : v.published ? (
                              <Badge variant="outline" title="Эта версия была на сайте раньше, сейчас опубликована другая">
                                Была на сайте
                              </Badge>
                            ) : (
                              <Badge variant="warning" title="Сохранённый черновик, на сайт никогда не публиковался">
                                Черновик
                              </Badge>
                            )}
                            {!v.viaAdmin && (
                              <span className="text-xs text-muted-foreground" title="Изменено напрямую через git, не через админку">
                                вручную (git)
                              </span>
                            )}
                          </span>
                        </span>
                        {!v.published && !diffMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="invisible h-7 w-7 shrink-0 group-hover:visible"
                            title="Удалить версию навсегда"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              doDeleteVersion(v);
                            }}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </aside>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Выберите файл слева, чтобы начать редактирование
          </div>
        )}
      </main>
      </div>
    </>
  );
}
