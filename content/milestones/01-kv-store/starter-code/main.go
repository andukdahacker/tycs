package main

import (
	"encoding/binary"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"sync"
	"time"
)

// KVStore is a simple in-memory key-value store with disk persistence.
// Data is stored in a Go map and serialized to a binary file on disk.
type KVStore struct {
	mu       sync.Mutex
	data     map[string]string
	filePath string
	file     *os.File
}

// NewKVStore creates a new KVStore backed by the given file path.
// If the file already exists, it loads existing data from disk.
func NewKVStore(filePath string) (*KVStore, error) {
	store := &KVStore{
		data:     make(map[string]string),
		filePath: filePath,
	}

	// Open or create the data file
	f, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open data file: %w", err)
	}
	store.file = f

	// Load any existing data from disk
	if err := store.loadFromDisk(); err != nil {
		store.file.Close()
		return nil, fmt.Errorf("failed to load data: %w", err)
	}

	return store, nil
}

// Close flushes data to disk and closes the underlying file.
func (s *KVStore) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.saveToDisk(); err != nil {
		s.file.Close()
		return err
	}
	return s.file.Close()
}

// Get retrieves the value associated with the given key.
// Returns the value and true if found, or an empty string and false if not.
//
// TODO: Implement this method.
// - Look up the key in s.data
// - Return the value and whether it was found
func (s *KVStore) Get(key string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// TODO: implement Get
	return "", false
}

// Put stores a key-value pair and persists the change to disk.
//
// TODO: Implement this method.
// - Store the key-value pair in s.data
// - Call s.saveToDisk() to persist
// - Return any error from saving
func (s *KVStore) Put(key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// TODO: implement Put
	return nil
}

// Delete removes a key from the store and persists the change to disk.
//
// TODO: Implement this method.
// - Remove the key from s.data
// - Call s.saveToDisk() to persist
// - Return any error from saving
func (s *KVStore) Delete(key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// TODO: implement Delete
	return nil
}

// saveToDisk writes all key-value pairs to the data file in binary format.
// The caller must hold s.mu.
//
// TODO: Implement this method.
// Binary format for each entry: [key_len:4 bytes][key bytes][value_len:4 bytes][value bytes]
// - Seek to the beginning of the file and truncate it
// - For each key-value pair in s.data, write the key length (uint32), key bytes,
//   value length (uint32), and value bytes
// - Hint: look at encoding/binary.Write and binary.BigEndian
func (s *KVStore) saveToDisk() error {
	// TODO: implement saveToDisk
	return nil
}

// loadFromDisk reads all key-value pairs from the data file into memory.
// The caller must hold s.mu.
//
// TODO: Implement this method.
// - Seek to the beginning of the file
// - Read entries in a loop until EOF
// - For each entry: read key_len (uint32), then key bytes, then value_len (uint32), then value bytes
// - Store each pair in s.data
// - Hint: look at encoding/binary.Read and io.EOF
func (s *KVStore) loadFromDisk() error {
	// TODO: implement loadFromDisk
	return nil
}

// --- CLI harness (complete — do not modify) ---

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "test":
		runTests()
	case "benchmark":
		runBenchmark()
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Usage: go run main.go <command>")
	fmt.Println()
	fmt.Println("Commands:")
	fmt.Println("  test       Run acceptance criteria tests")
	fmt.Println("  benchmark  Run performance benchmark")
}

func runTests() {
	dataFile := "test_data.db"
	defer os.Remove(dataFile)

	// Test: put-and-get
	fmt.Println("=== put-and-get ===")
	store, err := NewKVStore(dataFile)
	if err != nil {
		fmt.Printf("FAIL: could not create store: %v\n", err)
		os.Exit(1)
	}
	if err := store.Put("name", "mycscompanion"); err != nil {
		fmt.Printf("FAIL: put error: %v\n", err)
	}
	if val, ok := store.Get("name"); ok && val == "mycscompanion" {
		fmt.Println("PASS: put-and-get")
	} else {
		fmt.Printf("FAIL: expected 'mycscompanion', got '%s' (found=%v)\n", val, ok)
	}
	store.Close()
	os.Remove(dataFile)

	// Test: get-missing-key
	fmt.Println("=== get-missing-key ===")
	store, _ = NewKVStore(dataFile)
	if _, ok := store.Get("nonexistent"); !ok {
		fmt.Println("PASS: get-missing-key")
	} else {
		fmt.Println("FAIL: expected key not found")
	}
	store.Close()
	os.Remove(dataFile)

	// Test: delete-key
	fmt.Println("=== delete-key ===")
	store, _ = NewKVStore(dataFile)
	store.Put("temp", "value")
	store.Delete("temp")
	if _, ok := store.Get("temp"); !ok {
		fmt.Println("PASS: delete-key")
	} else {
		fmt.Println("FAIL: key still exists after delete")
	}
	store.Close()
	os.Remove(dataFile)

	// Test: overwrite-key
	fmt.Println("=== overwrite-key ===")
	store, _ = NewKVStore(dataFile)
	store.Put("key", "first")
	store.Put("key", "second")
	if val, ok := store.Get("key"); ok && val == "second" {
		fmt.Println("PASS: overwrite-key")
	} else {
		fmt.Printf("FAIL: expected 'second', got '%s'\n", val)
	}
	store.Close()
	os.Remove(dataFile)

	// Test: persistence-write and persistence-reload
	fmt.Println("=== persistence ===")
	store, _ = NewKVStore(dataFile)
	store.Put("persist", "across-restart")
	store.Close()

	// Check file exists (persistence-write)
	if _, err := os.Stat(dataFile); err == nil {
		fmt.Println("PASS: persistence-write")
	} else {
		fmt.Println("FAIL: data file not found after close")
	}

	// Reopen and check data (persistence-reload)
	store2, err := NewKVStore(dataFile)
	if err != nil {
		fmt.Printf("FAIL: could not reopen store: %v\n", err)
	} else {
		if val, ok := store2.Get("persist"); ok && val == "across-restart" {
			fmt.Println("PASS: persistence-reload")
		} else {
			fmt.Printf("FAIL: expected 'across-restart', got '%s' (found=%v)\n", val, ok)
		}
		store2.Close()
	}
	os.Remove(dataFile)

	// Test: multiple-keys
	fmt.Println("=== multiple-keys ===")
	store, _ = NewKVStore(dataFile)
	allOk := true
	for i := 0; i < 100; i++ {
		key := fmt.Sprintf("key-%d", i)
		value := fmt.Sprintf("value-%d", i)
		store.Put(key, value)
	}
	for i := 0; i < 100; i++ {
		key := fmt.Sprintf("key-%d", i)
		expected := fmt.Sprintf("value-%d", i)
		if val, ok := store.Get(key); !ok || val != expected {
			fmt.Printf("FAIL: key=%s expected=%s got=%s\n", key, expected, val)
			allOk = false
			break
		}
	}
	if allOk {
		fmt.Println("PASS: multiple-keys")
	}
	store.Close()
	os.Remove(dataFile)

	fmt.Println("=== done ===")
}

func runBenchmark() {
	dataFile := "bench_data.db"
	defer os.Remove(dataFile)

	// Generate workload: 1000 KV pairs, 16-byte keys, 64-byte values
	const numKeys = 1000
	keys := make([]string, numKeys)
	values := make([]string, numKeys)
	for i := 0; i < numKeys; i++ {
		keys[i] = randomString(16)
		values[i] = randomString(64)
	}

	// Warmup
	fmt.Println("Warming up...")
	for w := 0; w < 2; w++ {
		os.Remove(dataFile)
		store, _ := NewKVStore(dataFile)
		for i := 0; i < numKeys; i++ {
			store.Put(keys[i], values[i])
		}
		store.Close()
	}

	// Measured runs
	fmt.Println("Benchmarking sequential inserts...")
	var totalDuration time.Duration
	const measuredRuns = 10

	for r := 0; r < measuredRuns; r++ {
		os.Remove(dataFile)
		store, _ := NewKVStore(dataFile)

		start := time.Now()
		for i := 0; i < numKeys; i++ {
			store.Put(keys[i], values[i])
		}
		elapsed := time.Since(start)
		totalDuration += elapsed
		store.Close()
	}

	avgDuration := totalDuration / measuredRuns
	opsPerSec := float64(numKeys) / avgDuration.Seconds()

	fmt.Printf("Results: %d inserts, avg %.2fms, %.0f ops/sec\n",
		numKeys, float64(avgDuration.Microseconds())/1000.0, opsPerSec)
}

func randomString(n int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	var b strings.Builder
	for i := 0; i < n; i++ {
		b.WriteByte(charset[rand.Intn(len(charset))])
	}
	return b.String()
}

// Ensure imports are used (binary is needed for TODO implementations)
var _ = binary.BigEndian
