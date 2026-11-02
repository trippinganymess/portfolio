import React from 'react';
import PageLayout from './PageLayout';
import './blog.css';

export default function Blog({ navigation }) {
  return (
    <PageLayout className="blog-page" titleId="blog-title" pageName="Blog" navigation={navigation}>
      <header className="blog-heading">
        <p lang="hi">ब्लॉग</p>
        <h1 id="blog-title">Blog</h1>
      </header>

      <section className="blog-coming-soon" aria-labelledby="blog-blogs-title">
        <p className="blog-note">A few pages are taking shape.</p>
        <h2 id="blog-blogs-title">Blogs coming soon<span aria-hidden="true">.</span></h2>
        <p className="blog-description">Thoughts, stories, and notes will find a home here.</p>
      </section>
    </PageLayout>
  );
}
