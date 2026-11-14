import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';

interface Props {
  message: string;
  error?: boolean;
}

export default function Toast({ message, error = false }: Props) {
  return (
    <div className={`toast ${error ? 'toast-error' : ''}`}>
      <FontAwesomeIcon icon={error ? faCircleExclamation : faCheck} />
      {message}
    </div>
  );
}
