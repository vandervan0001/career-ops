package model

// Mandat represents a single consulting mandate from the tracker.
type Mandat struct {
	Number       int
	Date         string
	Client       string
	Title        string
	Status       string
	Score        float64
	ScoreRaw     string
	HasPDF       bool
	ReportPath   string
	ReportNumber string
	TJM          int
	Notes        string
	JobURL       string
	Archetype    string
	TlDr         string
	Remote       string
	CompEstimate string
}

// PipelineMetrics holds aggregate stats for the pipeline dashboard.
type PipelineMetrics struct {
	Total      int
	ByStatus   map[string]int
	AvgScore   float64
	TopScore   float64
	WithPDF    int
	AvgTJM     float64
	Actionable int
}
