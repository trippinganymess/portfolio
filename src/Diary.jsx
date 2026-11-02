import React from 'react';
import PageLayout from './PageLayout';
import './diary.css';

export default function Diary({ navigation }) {
  return (
    <PageLayout className="diary-page" titleId="diary-title" pageName="Diary" navigation={navigation}>
      <header className="diary-heading">
        <p lang="hi">डायरी</p>
        <h1 id="diary-title">Diary</h1>
      </header>

      <section className="diary-coming-soon" aria-labelledby="diary-blogs-title">
        <p className="diary-note">A few pages are taking shape.</p>
        <h2 id="diary-blogs-title">Blogs coming soon<span aria-hidden="true">.</span></h2>
        <p className="diary-description">Thoughts, stories, and notes will find a home here.</p>
      </section>
    </PageLayout>
  );
}
