import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { apiFetch } from '../services/api';
import { contentTypeIcon } from '../notes/contentTypeIcon';
import type { SearchBoardResult, SearchNoteResult } from '../services/types';

interface SearchDialogProps {
  onClose: () => void;
  onSelectNote: (result: SearchNoteResult) => void;
  onSelectBoard: (result: SearchBoardResult) => void;
}

const DEBOUNCE_MS = 250;

export function SearchDialog({ onClose, onSelectNote, onSelectBoard }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<SearchNoteResult[]>([]);
  const [boards, setBoards] = useState<SearchBoardResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setNotes([]);
      setBoards([]);
      return;
    }
    timeoutRef.current = setTimeout(() => {
      setSearching(true);
      apiFetch<{ notes: SearchNoteResult[]; boards: SearchBoardResult[] }>(
        `/search?q=${encodeURIComponent(trimmed)}`,
      )
        .then(({ notes, boards }) => {
          setNotes(notes);
          setBoards(boards);
        })
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query]);

  const hasResults = notes.length > 0 || boards.length > 0;

  return (
    <Modal title="Search" onClose={onClose}>
      <input
        ref={inputRef}
        className="input"
        type="text"
        placeholder="Search notes and boards…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {searching && <p className="search-dialog__status">Searching…</p>}
      {!searching && query.trim() && !hasResults && (
        <p className="search-dialog__status">No results.</p>
      )}
      {boards.length > 0 && (
        <div className="search-dialog__section">
          <h3>Boards</h3>
          <ul className="search-dialog__list">
            {boards.map((b) => (
              <li key={b.id}>
                <button className="search-dialog__result" onClick={() => onSelectBoard(b)}>
                  <span>{b.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {notes.length > 0 && (
        <div className="search-dialog__section">
          <h3>Notes</h3>
          <ul className="search-dialog__list">
            {notes.map((n) => (
              <li key={n.id}>
                <button className="search-dialog__result" onClick={() => onSelectNote(n)}>
                  <span className="search-dialog__icon">{contentTypeIcon(n.contentType)}</span>
                  <span className="search-dialog__title">{n.title}</span>
                  <span className="search-dialog__board">in {n.boardName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
