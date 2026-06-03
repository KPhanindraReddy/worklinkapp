import { ImagePlus, SendHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { fromNow } from '../../utils/formatters';

export const ChatWindow = ({
  conversation,
  messages,
  currentUserId,
  currentUserRole,
  onSend,
  canSend = true,
  lockedMessage = ''
}) => {
  const [draft, setDraft] = useState('');
  const typingState = useMemo(
    () => Object.values(conversation?.typing ?? {}).some(Boolean),
    [conversation?.typing]
  );
  const quickReplies = useMemo(() => {
    if (currentUserRole === 'labour') {
      return [
        'I am on my way, reaching in 10 mins.',
        'I am arriving now.',
        'Running a little late, please wait.',
        'Work is completed, please check.'
      ];
    }

    return [
      'Are you coming now?',
      'How long will it take to reach?',
      'Please share your ETA.',
      'Please confirm once you are on the way.'
    ];
  }, [currentUserRole]);

  if (!conversation) {
    return (
      <Card className="grid min-h-[24rem] place-items-center text-center xl:min-h-[520px]">
        <div>
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Choose a conversation</h3>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            Open any booking conversation to chat, share updates, and confirm work.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="surface-card flex min-h-[calc(100dvh-13rem)] max-w-full flex-col overflow-hidden xl:min-h-[520px]">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-950 dark:text-white">
              {conversation.displayName || conversation.participantName}
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              {lockedMessage
                ? lockedMessage
                : typingState
                  ? 'Typing...'
                  : conversation.online
                    ? 'Online now'
                    : 'Away'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              as="a"
              href={conversation.phoneNumber ? `tel:${conversation.phoneNumber}` : undefined}
              variant="outline"
              size="sm"
              className={!conversation.phoneNumber ? 'pointer-events-none opacity-60' : undefined}
            >
              Call
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => {
          const isMine = message.senderId === currentUserId;
          return (
            <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[88%] break-words rounded-[20px] px-3.5 py-2.5 text-[13px] shadow-sm sm:max-w-[80%] ${
                  isMine
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                {message.imageUrl ? (
                  <img
                    src={message.imageUrl}
                    alt="Chat attachment"
                    className="mb-3 max-h-56 w-full rounded-2xl object-cover"
                  />
                ) : null}
                {message.text ? <p>{message.text}</p> : null}
                <p
                  className={`mt-2 text-[11px] ${
                    isMine ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {fromNow(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        {canSend ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {quickReplies.map((message) => (
              <button
                key={message}
                type="button"
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-[12px] font-medium text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                onClick={() => {
                  setDraft(message);
                }}
              >
                {message}
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSend || !draft.trim()) {
              return;
            }
            onSend(draft.trim());
            setDraft('');
          }}
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0"
              aria-label="Attach image"
              disabled={!canSend}
            >
              <ImagePlus size={16} />
            </Button>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={canSend ? 'Type a message...' : 'Chat closed after service completion'}
              disabled={!canSend}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 sm:text-[13px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:ring-brand-500/20"
            />
            <Button
              type="submit"
              className="h-11 w-11 p-0 sm:w-auto sm:px-3.5"
              aria-label="Send message"
              disabled={!canSend || !draft.trim()}
            >
              <SendHorizontal size={16} />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
