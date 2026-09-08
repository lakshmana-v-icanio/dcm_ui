import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';

type CommonTextInputProps = TextFieldProps & {
  label: string;
};

const CommonTextInput = (props: CommonTextInputProps) => {
  return (
    <TextField
      fullWidth
      variant="outlined"
      size="medium"
      {...props}
      slotProps={{
        inputLabel: { shrink: true },
        ...props.slotProps,
      }}
    />
  );
};

export default CommonTextInput;
