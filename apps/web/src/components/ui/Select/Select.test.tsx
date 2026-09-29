import { composeStories } from '@storybook/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

import { Select } from './Select';
import * as stories from './Select.stories';

import type { SelectOption } from './Select.types';

const { Default, Disabled, WithError, WithHelptext, PreSelected } = composeStories(stories);

const OPTIONS: SelectOption[] = [
  { label: 'One', value: 'one' },
  { label: 'Two', value: 'two' },
];

describe('Select', () => {
  describe('Rendering', () => {
    it('links the label to the control', () => {
      const { getByLabelText } = render(<Default />);
      expect(getByLabelText('Account type')).toBeInTheDocument();
    });

    it('renders every provided option', () => {
      const { getAllByRole } = render(<Default />);
      // 3 options + 1 placeholder option = 4
      expect(getAllByRole('option')).toHaveLength(4);
    });

    it('reflects a pre-selected value', () => {
      const { getByLabelText } = render(<PreSelected />);
      expect(getByLabelText('Account type')).toHaveValue('transaction');
    });
  });

  describe('States', () => {
    it('is disabled when the disabled prop is set', () => {
      const { getByLabelText } = render(<Disabled />);
      expect(getByLabelText('Account type')).toBeDisabled();
    });

    it('surfaces the error message with aria-invalid', () => {
      const { getByLabelText, getByRole } = render(<WithError />);
      expect(getByLabelText('Account type')).toHaveAttribute('aria-invalid', 'true');
      expect(getByRole('alert')).toHaveTextContent('Please choose an account.');
    });
  });

  describe('Interactions', () => {
    it('fires onChange with the selected value', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      const { getByLabelText } = render(
        <Select label="Pick" value="" options={OPTIONS} onChange={onChange} />,
      );
      await user.selectOptions(getByLabelText('Pick'), 'two');
      expect(onChange).toHaveBeenCalledWith('two');
    });
  });

  describe('Accessibility', () => {
    it('associates helptext below the control', () => {
      const { getByText } = render(<WithHelptext />);
      expect(getByText('Select the account this applies to.')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('forwards a ref to the underlying container element', () => {
      const ref = createRef<HTMLDivElement>();
      render(<Select ref={ref} label="Ref" value="" options={OPTIONS} />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});
