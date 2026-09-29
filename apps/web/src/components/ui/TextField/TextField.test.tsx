import { composeStories } from '@storybook/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { TextField } from './TextField';
import * as stories from './TextField.stories';

const { Text, Disabled, WithHelptext, WithError, TextArea } = composeStories(stories);

describe('TextField', () => {
  describe('Rendering', () => {
    it('links the label to the input', () => {
      const { getByLabelText } = render(<Text />);
      expect(getByLabelText('Full name')).toBeInTheDocument();
    });

    it('renders a textarea for the textarea variant', () => {
      const { getByLabelText } = render(<TextArea />);
      expect(getByLabelText('Notes').tagName).toBe('TEXTAREA');
    });
  });

  describe('States', () => {
    it('is disabled when isDisabled is set', () => {
      const { getByLabelText } = render(<Disabled />);
      expect(getByLabelText('Disabled field')).toBeDisabled();
    });

    it('surfaces the error message with aria-invalid', () => {
      const { getByLabelText, getByRole } = render(<WithError />);
      expect(getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
      expect(getByRole('alert')).toHaveTextContent('This field is required.');
    });
  });

  describe('Interactions', () => {
    it('fires onChange as the user types', async () => {
      const user = userEvent.setup();
      const { getByLabelText } = render(<Text />);
      const input = getByLabelText('Full name');
      await user.type(input, 'Ada');
      // Story is controlled via useState, so the value reflects the typed text.
      expect(input).toHaveValue('Ada');
    });

    it('fires onBlur when focus leaves the input', async () => {
      const onBlur = jest.fn();
      const user = userEvent.setup();
      const { getByLabelText } = render(
        <TextField
          id="blur-field"
          label="Blur field"
          value=""
          onChange={() => {}}
          onBlur={onBlur}
        />,
      );
      await user.click(getByLabelText('Blur field'));
      await user.tab();
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('associates helptext via aria-describedby', () => {
      const { getByLabelText } = render(<WithHelptext />);
      const input = getByLabelText('Full name');
      expect(input).toHaveAttribute('aria-describedby');
    });
  });

  describe('Edge Cases', () => {
    it('forwards a ref to the underlying input element', () => {
      const ref = createRef<HTMLInputElement | HTMLTextAreaElement>();
      render(<TextField ref={ref} id="ref-field" label="Ref field" value="" onChange={() => {}} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });
});
