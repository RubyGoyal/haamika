import React from 'react';
import type { Routine } from '../../../shared/types.js';
import { Dialog } from '../Dialog.js';

interface ReadingDialogProps {
  item: Routine | null;
  value: string;
  onChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const ReadingDialog: React.FC<ReadingDialogProps> = ({
  item,
  value,
  onChange,
  onSubmit,
  onClose,
}) => {
  return (
    <Dialog isOpen={Boolean(item)} onClose={onClose} title={`Record Reading: ${item?.label}`}>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="reading-val" className="form-label">
            Value (e.g. 135/85 for BP or 110 for Sugar)
          </label>
          <input
            id="reading-val"
            type="text"
            required
            className="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. 130/80"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '1rem' }}
        >
          Save Reading
        </button>
      </form>
    </Dialog>
  );
};
