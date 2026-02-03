import './auth.css';
import React, { useState } from 'react';
import email_icon from '../assets/email.png'
import password_icon from '../assets/password.png'
import user_icon from '../assets/person.png'

const API_BASE = '/api/auth';

const auth = () => {
    const [action, setAction] = useState("Sign Up");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState({ text: "", isError: false });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setMessage({ text: "", isError: false });
        setLoading(true);

        try {
            const url = action === "Sign Up" ? API_BASE + '/signup' : API_BASE + '/login';
            const body = action === "Sign Up" ? { name, email, password } : { email, password };
            const res = await fetch(url, {method: 'POST',headers: { 'Content-Type': 'application/json' },body: JSON.stringify(body),
            });

            const data = await res.json();

            if (data.success) {
                setMessage({ text: data.message, isError: false });
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            } else {
                setMessage({ text: data.message || 'Something went wrong', isError: true });
            }
        } catch (err) {
            setMessage({ text: 'Please try again', isError: true });
        } finally {
            setLoading(false);
        }
    };
    return (
        <>
            <div className="site-title">GradSIS</div>
            <div className="tagline">Welcome! Ready to graduate?</div>

            <div className='container'>

                <div className='header'>
                    <div className='tab-container'>

                        <div
                            className={action === "Sign Up" ? "submit" : "submit gray"}
                            onClick={() => {
                                setAction("Sign Up");
                                setMessage({ text: "", isError: false });
                            }}
                        >
                            Sign Up
                        </div>

                        <div
                            className={action === "Login" ? "submit" : "submit gray"}
                            onClick={() => {
                                setAction("Login");
                                setMessage({ text: "", isError: false });
                            }}
                        >
                            Login
                        </div>

                    </div>

                    <div className='text'>{action}</div>
                    <div className='underline'></div>
                </div>

                {message.text && (
                    <div className={message.isError ? 'message error' : 'message success'}>
                        {message.text}
                    </div>
                )}

                <div className="inputs">
                    {action === "Login" ? null : (
                        <div className="input">
                            <img src={user_icon} alt="" />
                            <input type="text"
                                placeholder="Enter your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="input">
                        <img src={email_icon} alt="" />
                        <input
                            type="email"
                            placeholder='Enter your email'
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="input">
                        <img src={password_icon} alt="" />
                        <input
                            type="password"
                            placeholder='Enter your password'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {action === "Sign Up" ? null : (
                        <div className="forgot-password">
                            Forgot Password?<span>Click here!</span>
                        </div>
                    )}
                    <div className='submit-container'>
                        <div
                            className="submit"
                            onClick={handleSubmit}
                        >
                            {loading ? 'Please wait...' : 'Submit'}
                        </div>
                    </div>


                </div>
            </div>
        </>
    );
}

export default auth;
