package main

import (
	"encoding/binary"
	"fmt"
	"io"
	"math/rand"
	"os"
	"strings"
	"sync"
	"time"
)

// KVStore is a simple in-memory key-value store with disk persistence.
type KVStore struct {
	mu       sync.Mutex
	data     map[string]string
	filePath string
	file     *os.File
}

// NewKVStore creates a new KVStore backed by the given file path.
func NewKVStore(filePath string) (*KVStore, error) {
	store := &KVStore{
		data:     make(map[string]string),
		filePath: filePath,
	}

	f, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open data file: %w", err)
	}
	store.file = f

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
	if err := s.file.Sync(); err != nil {
		s.file.Close()
		return err
	}
	return s.file.Close()
}

// Get retrieves the value associated with the given key.
func (s *KVStore) Get(key string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	val, ok := s.data[key]
	return val, ok
}

// Put stores a key-value pair and persists the change to disk.
func (s *KVStore) Put(key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.data[key] = value
	return s.saveToDisk()
}

// Delete removes a key from the store and persists the change to disk.
func (s *KVStore) Delete(key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.data, key)
	return s.saveToDisk()
}

// saveToDisk writes all key-value pairs to the data file in binary format.
// Format per entry: [key_len:4 bytes][key bytes][value_len:4 bytes][value bytes]
func (s *KVStore) saveToDisk() error {
	// Seek to beginning and truncate
	if _, err := s.file.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("seek error: %w", err)
	}
	if err := s.file.Truncate(0); err != nil {
		return fmt.Errorf("truncate error: %w", err)
	}

	for key, value := range s.data {
		// Write key length + key
		if err := binary.Write(s.file, binary.BigEndian, uint32(len(key))); err != nil {
			return fmt.Errorf("write key length error: %w", err)
		}
		if _, err := s.file.Write([]byte(key)); err != nil {
			return fmt.Errorf("write key error: %w", err)
		}

		// Write value length + value
		if err := binary.Write(s.file, binary.BigEndian, uint32(len(value))); err != nil {
			return fmt.Errorf("write value length error: %w", err)
		}
		if _, err := s.file.Write([]byte(value)); err != nil {
			return fmt.Errorf("write value error: %w", err)
		}
	}

	return nil
}

// loadFromDisk reads all key-value pairs from the data file into memory.
func (s *KVStore) loadFromDisk() error {
	if _, err := s.file.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("seek error: %w", err)
	}

	for {
		// Read key length
		var keyLen uint32
		if err := binary.Read(s.file, binary.BigEndian, &keyLen); err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("read key length error: %w", err)
		}

		// Read key
		keyBuf := make([]byte, keyLen)
		if _, err := io.ReadFull(s.file, keyBuf); err != nil {
			return fmt.Errorf("read key error: %w", err)
		}

		// Read value length
		var valLen uint32
		if err := binary.Read(s.file, binary.BigEndian, &valLen); err != nil {
			return fmt.Errorf("read value length error: %w", err)
		}

		// Read value
		valBuf := make([]byte, valLen)
		if _, err := io.ReadFull(s.file, valBuf); err != nil {
			return fmt.Errorf("read value error: %w", err)
		}

		s.data[string(keyBuf)] = string(valBuf)
	}

	return nil
}

// --- CLI harness ---

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

	if _, err := os.Stat(dataFile); err == nil {
		fmt.Println("PASS: persistence-write")
	} else {
		fmt.Println("FAIL: data file not found after close")
	}

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

	const numKeys = 1000
	keys := make([]string, numKeys)
	values := make([]string, numKeys)
	for i := 0; i < numKeys; i++ {
		keys[i] = randomString(16)
		values[i] = randomString(64)
	}

	fmt.Println("Warming up...")
	for w := 0; w < 2; w++ {
		os.Remove(dataFile)
		store, _ := NewKVStore(dataFile)
		for i := 0; i < numKeys; i++ {
			store.Put(keys[i], values[i])
		}
		store.Close()
	}

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
