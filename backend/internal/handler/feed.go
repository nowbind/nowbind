package handler

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/http"
	"time"

	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/internal/repository"
)

type FeedHandler struct {
	posts       *repository.PostRepository
	siteURL     string
	frontendURL string
}

func NewFeedHandler(posts *repository.PostRepository, siteURL, frontendURL string) *FeedHandler {
	return &FeedHandler{posts: posts, siteURL: siteURL, frontendURL: frontendURL}
}

func (h *FeedHandler) RSS(w http.ResponseWriter, r *http.Request) {
	posts, _, err := h.posts.List(r.Context(), repository.ListPostsParams{
		Status:  "published",
		Page:    1,
		PerPage: 50,
	})
	if err != nil {
		http.Error(w, "failed to get posts", http.StatusInternalServerError)
		return
	}

	type Item struct {
		XMLName     xml.Name `xml:"item"`
		Title       string   `xml:"title"`
		Link        string   `xml:"link"`
		Description string   `xml:"description"`
		PubDate     string   `xml:"pubDate"`
		GUID        string   `xml:"guid"`
	}

	type Channel struct {
		XMLName       xml.Name `xml:"channel"`
		Title         string   `xml:"title"`
		Link          string   `xml:"link"`
		Description   string   `xml:"description"`
		LastBuildDate string   `xml:"lastBuildDate"`
		Items         []Item   `xml:"item"`
	}

	type RSS struct {
		XMLName xml.Name `xml:"rss"`
		Version string   `xml:"version,attr"`
		Channel Channel  `xml:"channel"`
	}

	var items []Item
	for _, p := range posts {
		pubDate := p.CreatedAt
		if p.PublishedAt != nil {
			pubDate = *p.PublishedAt
		}
		items = append(items, Item{
			Title:       p.Title,
			Link:        fmt.Sprintf("%s/post/%s", h.frontendURL, p.Slug),
			Description: p.Excerpt,
			PubDate:     pubDate.Format(time.RFC1123Z),
			GUID:        fmt.Sprintf("%s/post/%s", h.frontendURL, p.Slug),
		})
	}

	rss := RSS{
		Version: "2.0",
		Channel: Channel{
			Title:         "NowBind",
			Link:          h.frontendURL,
			Description:   "The open-source blogging platform for humans and AI agents",
			LastBuildDate: time.Now().Format(time.RFC1123Z),
			Items:         items,
		},
	}

	w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(xml.Header))
	xml.NewEncoder(w).Encode(rss)
}

func (h *FeedHandler) Atom(w http.ResponseWriter, r *http.Request) {
	posts, _, err := h.posts.List(r.Context(), repository.ListPostsParams{
		Status:  "published",
		Page:    1,
		PerPage: 50,
	})
	if err != nil {
		http.Error(w, "failed to get posts", http.StatusInternalServerError)
		return
	}

	type Link struct {
		XMLName xml.Name `xml:"link"`
		Href    string   `xml:"href,attr"`
		Rel     string   `xml:"rel,attr,omitempty"`
	}
	type Author struct {
		Name string `xml:"name"`
	}
	type Entry struct {
		XMLName   xml.Name `xml:"entry"`
		Title     string   `xml:"title"`
		Link      Link
		ID        string `xml:"id"`
		Updated   string `xml:"updated"`
		Summary   string `xml:"summary"`
		Author    Author `xml:"author"`
	}
	type Feed struct {
		XMLName xml.Name `xml:"feed"`
		XMLNS   string   `xml:"xmlns,attr"`
		Title   string   `xml:"title"`
		Link    Link
		ID      string  `xml:"id"`
		Updated string  `xml:"updated"`
		Entries []Entry `xml:"entry"`
	}

	var entries []Entry
	for _, p := range posts {
		updated := p.UpdatedAt.Format(time.RFC3339)
		authorName := ""
		if p.Author != nil {
			authorName = p.Author.DisplayName
			if authorName == "" {
				authorName = p.Author.Username
			}
		}
		entries = append(entries, Entry{
			Title:   p.Title,
			Link:    Link{Href: fmt.Sprintf("%s/post/%s", h.frontendURL, p.Slug)},
			ID:      fmt.Sprintf("%s/post/%s", h.frontendURL, p.Slug),
			Updated: updated,
			Summary: p.Excerpt,
			Author:  Author{Name: authorName},
		})
	}

	feed := Feed{
		XMLNS:   "http://www.w3.org/2005/Atom",
		Title:   "NowBind",
		Link:    Link{Href: h.frontendURL + "/feed/atom.xml", Rel: "self"},
		ID:      h.frontendURL,
		Updated: time.Now().Format(time.RFC3339),
		Entries: entries,
	}

	w.Header().Set("Content-Type", "application/atom+xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(xml.Header))
	xml.NewEncoder(w).Encode(feed)
}

func (h *FeedHandler) JSON(w http.ResponseWriter, r *http.Request) {
	posts, _, err := h.posts.List(r.Context(), repository.ListPostsParams{
		Status:  "published",
		Page:    1,
		PerPage: 50,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get posts")
		return
	}

	type JSONItem struct {
		ID            string   `json:"id"`
		URL           string   `json:"url"`
		Title         string   `json:"title"`
		Summary       string   `json:"summary"`
		DatePublished string   `json:"date_published"`
		DateModified  string   `json:"date_modified"`
		Author        struct {
			Name string `json:"name"`
		} `json:"author"`
		Tags []string `json:"tags"`
	}

	type JSONFeed struct {
		Version     string     `json:"version"`
		Title       string     `json:"title"`
		HomePageURL string     `json:"home_page_url"`
		FeedURL     string     `json:"feed_url"`
		Items       []JSONItem `json:"items"`
	}

	var items []JSONItem
	for _, p := range posts {
		item := JSONItem{
			ID:           p.ID,
			URL:          fmt.Sprintf("%s/post/%s", h.frontendURL, p.Slug),
			Title:        p.Title,
			Summary:      p.Excerpt,
			DateModified: p.UpdatedAt.Format(time.RFC3339),
		}
		if p.PublishedAt != nil {
			item.DatePublished = p.PublishedAt.Format(time.RFC3339)
		}
		if p.Author != nil {
			item.Author.Name = p.Author.DisplayName
			if item.Author.Name == "" {
				item.Author.Name = p.Author.Username
			}
		}
		for _, t := range p.Tags {
			item.Tags = append(item.Tags, t.Name)
		}
		items = append(items, item)
	}

	feed := JSONFeed{
		Version:     "https://jsonfeed.org/version/1.1",
		Title:       "NowBind",
		HomePageURL: h.frontendURL,
		FeedURL:     h.frontendURL + "/feed/json",
		Items:       items,
	}

	w.Header().Set("Content-Type", "application/feed+json; charset=utf-8")
	json.NewEncoder(w).Encode(feed)
}

func postsToInterface(posts []model.Post) []interface{} {
	result := make([]interface{}, len(posts))
	for i, p := range posts {
		result[i] = p
	}
	return result
}
