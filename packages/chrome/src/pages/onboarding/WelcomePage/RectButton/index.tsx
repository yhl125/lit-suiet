import classnames from 'classnames';
import styles from './index.module.scss';
import { Extendable } from '../../../../types';
import { ReactComponent as PlusPrimary } from '../../../../assets/icons/plus-primary.svg';
import { ReactComponent as PlusSecondary } from '../../../../assets/icons/plus-secondary.svg';
import { ReactComponent as FingerPrint } from '../../../../assets/icons/fingerprint.svg';
import Icon from '../../../../components/Icon';

export type RectButtonProps = Extendable & {
  theme?: 'primary' | 'default' | 'biometric' | 'biometric-secondary';
  to?: string;
  onClick?: () => void;
};

const RectButton = (props: RectButtonProps) => {
  const { theme = 'default' } = props;
  let icon;
  if (theme === 'primary') {
    icon = <Icon icon={<PlusPrimary />}></Icon>;
  } else if (theme === 'biometric') {
    icon = (
      <span className={styles['create-biometric__logo']}>
        <FingerPrint width="24" height="24" />
      </span>
    );
  } else if (theme === 'biometric-secondary') {
    icon = (
      <span className={styles['signin-biometric__logo']}>
        <FingerPrint width="24" height="24" />
      </span>
    );
  } else {
    icon = <Icon icon={<PlusSecondary />} />;
  }
  return (
    <button
      onClick={props.onClick}
      className={classnames(
        styles['rect-btn'],
        styles[`rect-btn--${theme}`],
        props.className
      )}
    >
      {icon}
      {props.children}
    </button>
  );
};

export default RectButton;
