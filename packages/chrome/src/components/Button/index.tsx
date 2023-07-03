import classnames from 'classnames';
import styles from './index.module.scss';
import { Extendable } from '../../types';
import { LoadingSpokes } from '../../components/Loading';

export type ButtonState = 'normal' | 'primary' | 'danger';

export type ButtonProps = Extendable & {
  type?: 'button' | 'submit' | 'reset';
  state?: ButtonState;
  loading?: boolean;
  disabled?: boolean;
  solidBackground?: boolean;
  onClick?: () => void;
};

const Button = (props: ButtonProps) => {
  const {
    children,
    state = 'normal',
    loading = false,
    disabled = false,
    solidBackground = false,
    ...restProps
  } = props;

  const _disabled = loading || disabled;
  return (
    <button
      {...restProps}
      disabled={_disabled}
      className={classnames(
        styles['button'],
        { [styles[`button--${state}`]]: state !== 'normal' },
        { [styles[`button--solid`]]: solidBackground },
        { [styles[`button--disabled`]]: _disabled },
        props.className
      )}
    >
      {children}
      {loading && (
        <LoadingSpokes width={'20px'} height={'20px'} color={'#fff'} />
      )}
    </button>
  );
};

export default Button;
