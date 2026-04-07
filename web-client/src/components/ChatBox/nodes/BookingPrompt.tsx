import { QuickReplyChips } from '../widgets/QuickReplyChips';
import styles from './BookingPrompt.module.scss';

interface BookingPromptProps {
  experiencesEmpty: boolean;
  carRentalsEmpty: boolean;
  onBookNow: () => void;
  onQuickReply: (text: string) => void;
}

const CHIP_BOOK_NOW = 'Book now';
const CHIP_ADD_EXPERIENCES = 'Add experiences';
const CHIP_ADD_CAR_RENTAL = 'Add car rental';
const CHIP_CHANGE_SOMETHING = 'Change something';

const ADD_EXPERIENCES_PROMPT =
  'Can you suggest some experiences for this trip?';
const ADD_CAR_RENTAL_PROMPT = 'Can you find a car rental for this trip?';
const CHANGE_SOMETHING_PROMPT =
  "I'd like to make some changes to the itinerary. What would you suggest adjusting?";

export function BookingPrompt({
  experiencesEmpty,
  carRentalsEmpty,
  onBookNow,
  onQuickReply,
}: BookingPromptProps) {
  const chips: string[] = [CHIP_BOOK_NOW];
  if (experiencesEmpty) chips.push(CHIP_ADD_EXPERIENCES);
  if (carRentalsEmpty) chips.push(CHIP_ADD_CAR_RENTAL);
  chips.push(CHIP_CHANGE_SOMETHING);

  const handleSelect = (chip: string) => {
    if (chip === CHIP_BOOK_NOW) {
      onBookNow();
      return;
    }
    if (chip === CHIP_ADD_EXPERIENCES) {
      onQuickReply(ADD_EXPERIENCES_PROMPT);
      return;
    }
    if (chip === CHIP_ADD_CAR_RENTAL) {
      onQuickReply(ADD_CAR_RENTAL_PROMPT);
      return;
    }
    if (chip === CHIP_CHANGE_SOMETHING) {
      onQuickReply(CHANGE_SOMETHING_PROMPT);
      return;
    }
  };

  return (
    <div className={styles.wrapper}>
      <p className={styles.body}>
        Ready to book this trip, or want to keep refining?
      </p>
      <QuickReplyChips chips={chips} onSelect={handleSelect} />
    </div>
  );
}
