import { Select } from "@/components/ui/input";

/**
 * A filter <select> that applies itself: choosing an option submits the enclosing GET form, so the list
 * updates straight away. The form's Apply button still works for the search box and without JavaScript.
 */
export function AutoSubmitSelect(props) {
  return <Select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
