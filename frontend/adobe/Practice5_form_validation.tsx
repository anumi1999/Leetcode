import React, { useMemo, useState } from "react";

type FormValues = {
  name: string;
  email: string;
  password: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email.";
  }

  if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return errors;
}

const Practice5FormValidation: React.FC = () => {
  const [values, setValues] = useState<FormValues>({
    name: "",
    email: "",
    password: "",
  });
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => validate(values), [values]);
  const hasErrors = Object.keys(errors).length > 0;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!hasErrors) {
      alert("Form submitted successfully!");
    }
  };

  return (
    <section>
      <h2>Form Validation Practice</h2>

      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" value={values.name} onChange={onChange} onBlur={onBlur} />
        {(touched.name || submitted) && errors.name && <p role="alert">{errors.name}</p>}

        <label htmlFor="email">Email</label>
        <input id="email" name="email" value={values.email} onChange={onChange} onBlur={onBlur} />
        {(touched.email || submitted) && errors.email && <p role="alert">{errors.email}</p>}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          name="password"
          value={values.password}
          onChange={onChange}
          onBlur={onBlur}
        />
        {(touched.password || submitted) && errors.password && <p role="alert">{errors.password}</p>}

        <button type="submit">Submit</button>
      </form>
    </section>
  );
};

export default Practice5FormValidation;
